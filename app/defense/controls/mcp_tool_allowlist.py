from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class McpToolAllowlistControl(DefenseControl):
    id = "mcp.tool_allowlist"
    name = "MCP tool allowlist"
    verifies = (
        "tools/call is denied when the lab lists that tool as blocked at this defense level"
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        if decision.context.get("op") != "call":
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        name = str(decision.context.get("tool") or "")
        for row in decision.context.get("blocked_calls") or []:
            if not isinstance(row, dict):
                continue
            if str(row.get("tool") or "") != name:
                continue
            try:
                minimum = int(row.get("min_level") or 1)
            except (TypeError, ValueError):
                minimum = 1
            if decision.level >= minimum:
                return ControlOutcome(
                    action=ControlAction.DENY,
                    payload=decision.payload,
                    control_id=self.id,
                    reason=f"tool {name!r} is blocked at this defense level",
                    rejection_key="mcp_tool_blocked",
                )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
