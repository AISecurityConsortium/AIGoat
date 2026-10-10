"""agent.runner — shop-agent surface over the Intent Gate."""
from __future__ import annotations

from typing import Any

from app.core.exceptions import ValidationError
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript


class AgentRunnerSurface(TargetSurface):
    id = "agent.runner"
    name = "Shop agent"
    ui = "agent"
    capabilities = ("tools", "trace", "approval")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "allowed_tools": {"type": "array", "items": {"type": "string"}},
                "defense_override": {"type": ["integer", "null"]},
            },
            "additionalProperties": True,
        }

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        from app.agent.service import cancel_run, get_run, resolve_approval, start_run

        data = dict(req.input or {})
        run_id = data.get("run_id")
        decision = data.get("decision")
        if run_id and data.get("cancel"):
            payload = await cancel_run(req.db, req.user, str(run_id))
        elif run_id and decision in {"approve", "deny"}:
            payload = await resolve_approval(
                req.db,
                req.user,
                str(run_id),
                step_seq=int(data.get("step_seq") or 0),
                decision=str(decision),
            )
        elif run_id and not data.get("goal"):
            payload = await get_run(req.db, req.user, str(run_id))
        else:
            goal = str(data.get("goal") or data.get("message") or "")
            if not goal:
                raise ValidationError("goal is required")
            lab_id = req.lab_id or str(data.get("lab_id") or "")
            payload = await start_run(
                req.db,
                req.user,
                lab_id=lab_id,
                goal=goal,
                session_token=req.session_token,
                defense_level=data.get("defense_level"),
            )
        transcript = Transcript()
        skip = {"type", "seq", "ts", "raw", "transformed"}
        for event in payload.get("transcript") or []:
            extra = {k: v for k, v in event.items() if k not in skip}
            transcript.add(
                event["type"],
                raw=event.get("raw"),
                transformed=event.get("transformed"),
                **extra,
            )
        return SurfaceResult(
            result=payload,
            transcript=list(transcript.events),
            defense=payload.get("defense") or {
                "level": 0,
                "surface": "agent.runner",
                "controls_applied": [],
                "outcomes": [],
            },
            evaluation=payload.get("evaluation"),
        )
