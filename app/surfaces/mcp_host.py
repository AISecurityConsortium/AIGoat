"""mcp.host — admin assistant. The model picks a tool; the tool is a real MCP call."""
from __future__ import annotations

from typing import Any

from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript


class McpHostSurface(TargetSurface):
    id = "mcp.host"
    name = "Admin MCP assistant"
    ui = "mcp-host"
    capabilities = ("mcp", "agent", "trace")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "defense_override": {"type": ["integer", "null"]},
            },
            "additionalProperties": True,
        }

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        from app.mcp.host import host_turn

        data = dict(req.input or {})
        message = str(data.get("message") or data.get("goal") or "")
        level = int(data.get("defense_level") or 0)
        payload = await host_turn(
            req.db,
            req.user,
            message,
            lab_id=req.lab_id or "",
            defense_level=level,
            run_id=data.get("run_id"),
            decision=data.get("decision"),
        )
        transcript = Transcript()
        for event in payload.get("transcript") or []:
            if not isinstance(event, dict):
                continue
            kind = "mcp_response" if "result" in event and "method" not in event else "mcp_request"
            transcript.add(kind, raw=event)
        for step in payload.get("steps") or []:
            action = step.get("action")
            if action and action != "finish":
                transcript.add("tool_call", tool=action, arguments=step.get("arguments") or {})
        return SurfaceResult(
            result=payload,
            transcript=list(transcript.events),
            defense={"level": level, "surface": "mcp.host", "controls_applied": [], "outcomes": []},
        )
