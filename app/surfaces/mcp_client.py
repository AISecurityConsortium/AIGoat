"""mcp.client — in-app MCP client over AIGoat-shipped stdio servers."""
from __future__ import annotations

from typing import Any

from app.core.exceptions import ValidationError
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript


class McpClientSurface(TargetSurface):
    id = "mcp.client"
    name = "MCP client"
    ui = "mcp"
    capabilities = ("mcp", "trace")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "server_id": {"type": "string"},
                "pinned_descriptions": {"type": "object"},
                "defense_override": {"type": ["integer", "null"]},
            },
            "additionalProperties": True,
        }

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        from app.mcp.service import execute_mcp

        data = dict(req.input or {})
        if not data.get("server_id"):
            raise ValidationError("server_id is required")
        payload = await execute_mcp(user=req.user, lab_id=req.lab_id, data=data)
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
                "surface": "mcp.client",
                "controls_applied": [],
                "outcomes": [],
            },
            evaluation=payload.get("evaluation"),
        )
