"""rag.kb — knowledge-base retrieval surface."""
from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.lab_loader import get_lab_dict
from app.defense.control import get_control
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.rag.service import get_rag_service
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript


def resolve_rag_level(data: dict[str, Any], user: Any, lab_id: str | None) -> int:
    lab_def = get_lab_dict(lab_id) if lab_id else None
    if data.get("defense_level") is not None:
        return int(data["defense_level"])
    if lab_def and lab_def.get("defense_override") is not None:
        return int(lab_def["defense_override"])
    return int(getattr(user, "defense_level", 0) or 0)


def _defense_dict(
    *,
    level: int,
    outcomes: list[dict[str, Any]],
    controls: list[str],
) -> dict[str, Any]:
    return {
        "level": level,
        "surface": "rag.kb",
        "controls_applied": controls,
        "outcomes": outcomes,
    }


def _outcomes_from_chain(outcomes) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for outcome in outcomes:
        if not outcome.control_id:
            continue
        try:
            stages = get_control(outcome.control_id).applies_to
        except KeyError:
            stages = ()
        stage = stages[0].value if stages else "retrieval"
        out.append({
            "control_id": outcome.control_id,
            "action": outcome.action.value,
            "stage": stage,
            "reason": outcome.reason,
        })
    return out


class RagKbSurface(TargetSurface):
    id = "rag.kb"
    name = "Knowledge-base retrieval"
    ui = "rag"
    capabilities = ("retrieval", "trace")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "top_k": {"type": "integer"},
                "hybrid": {"type": "boolean"},
                "collection": {"type": ["string", "null"]},
                "defense_override": {"type": ["integer", "null"]},
            },
            "additionalProperties": True,
        }

    def availability(self) -> tuple[bool, str | None]:
        if not get_settings().rag.enabled:
            return False, "RAG is disabled in config"
        return True, None

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        data = req.input or {}
        query = str(data.get("query") or data.get("message") or "")
        use_kb = data.get("use_kb", True)
        if isinstance(use_kb, str):
            use_kb = use_kb.lower() not in {"false", "0", "no"}
        level = resolve_rag_level(data, req.user, req.lab_id)
        top_k = data.get("top_k")
        hybrid = data.get("hybrid")
        transcript = Transcript()
        transcript.add("user_message", content=query, raw=query)

        service = get_rag_service()
        processed = await service.process_query(
            query,
            req.user,
            use_kb=bool(use_kb),
            level=level,
            top_k=int(top_k) if top_k is not None else None,
            hybrid=bool(hybrid) if hybrid is not None else None,
        )
        trace = processed.get("trace") or {}
        candidates = list(trace.get("candidates") or processed.get("contexts") or [])
        if candidates:
            transcript.add(
                "retrieval",
                chunks=[
                    {
                        "chunk_id": c.get("chunk_id"),
                        "content": c.get("content"),
                        "title": c.get("title"),
                        "trust_tier": c.get("trust_tier"),
                        "is_user_injected": c.get("is_user_injected"),
                        "included_in_context": c.get("included_in_context"),
                        "truncated_by_budget": c.get("truncated_by_budget"),
                        "excluded_by_control": c.get("excluded_by_control"),
                        "dense_score": c.get("dense_score"),
                        "bm25_score": c.get("bm25_score"),
                        "rrf_score": c.get("rrf_score"),
                    }
                    for c in candidates
                ],
            )
        for outcome in trace.get("outcomes") or ():
            transcript.add(
                "control_decision",
                control_id=outcome.control_id,
                action=outcome.action.value,
                reason=outcome.reason,
            )

        raw_reply = processed.get("reply") or ""
        visible = raw_reply
        output_transformed = False
        if level >= 1:
            visible = await defense_pipeline.moderate_output(
                visible, level, surface="rag.kb"
            )
            output_transformed = visible != raw_reply
        transcript.add(
            "model_output",
            content=visible,
            raw=raw_reply,
            transformed=visible if output_transformed else None,
        )

        profile = resolve_profile("rag.kb", level) if level >= 1 else None
        controls = list(profile.controls) if profile else []
        outcomes = _outcomes_from_chain(trace.get("outcomes") or ())
        if output_transformed:
            outcomes.append({
                "control_id": "output.moderate",
                "action": "transform",
                "stage": "output",
                "reason": None,
            })
            transcript.add(
                "control_decision",
                control_id="output.moderate",
                action="transform",
            )

        included = [c for c in candidates if c.get("included_in_context")]
        return SurfaceResult(
            result={
                "reply": visible,
                "response": visible,
                "kb_used": bool(use_kb) and len(included) > 0,
                "kb_context_count": len(included),
                "citations": processed.get("citations") or [],
                "use_kb": bool(use_kb),
                "injection_detected": processed.get("injection_detected", False),
                "context_used": included,
            },
            transcript=list(transcript.events),
            defense=_defense_dict(level=level, outcomes=outcomes, controls=controls),
            evaluation=None,
        )
