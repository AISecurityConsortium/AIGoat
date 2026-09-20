from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_NEEDLES = (
    "ignore previous",
    "ignore all previous",
    "important: before answering",
    "before answering, call",
    "include its full output verbatim",
    "also call export_orders",
)


class McpDescriptionScanControl(DefenseControl):
    id = "mcp.description_scan"
    name = "MCP description injection scan"
    verifies = (
        "tool descriptions that carry instruction-override phrasing are redacted "
        "before they are shown as model-facing text"
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        tools = decision.context.get("tools")
        if not tools:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        redacted = 0
        for tool in tools:
            desc = str(tool.get("description") or "")
            lower = desc.lower()
            if any(needle in lower for needle in _NEEDLES):
                tool["description"] = "[redacted: injection phrasing in tool description]"
                tool["scan_redacted"] = True
                redacted += 1
        if redacted:
            return ControlOutcome(
                action=ControlAction.TRANSFORM,
                payload=decision.payload,
                control_id=self.id,
                reason=f"redacted {redacted} poisoned description(s)",
                metadata={"redacted": redacted},
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
