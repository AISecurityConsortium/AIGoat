"""skill.runtime — SKILL.md overlay onto agent.runner. Bundled scripts are never run."""
from __future__ import annotations

from typing import Any

from app.core.exceptions import ValidationError
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript


class SkillRuntimeSurface(TargetSurface):
    id = "skill.runtime"
    name = "Skill runtime"
    ui = "skills"
    capabilities = ("skills", "trace")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "skill_id": {"type": "string"},
                "pinned_body": {"type": "string"},
                "pinned_hash": {"type": "string"},
                "fetch_external_doc": {"type": "boolean"},
                "expected_skill": {"type": "string"},
                "defense_override": {"type": ["integer", "null"]},
            },
            "additionalProperties": True,
        }

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        from app.skills.runtime import execute_skill

        data = dict(req.input or {})
        if not data.get("action") and not data.get("op"):
            raise ValidationError("action is required")
        payload = await execute_skill(user=req.user, lab_id=req.lab_id, data=data)
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
            result=payload.get("result") or {},
            transcript=list(transcript.events),
            defense=payload.get("defense") or {
                "level": 0,
                "surface": "skill.runtime",
                "controls_applied": [],
                "outcomes": [],
            },
            evaluation=payload.get("evaluation"),
        )
