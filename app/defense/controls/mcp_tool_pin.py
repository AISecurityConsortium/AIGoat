from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class McpToolPinControl(DefenseControl):
    id = "mcp.tool_pin"
    name = "MCP tool description pin"
    verifies = (
        "tools/list descriptions that do not match the lab pin are restored, "
        "and tools/call is denied when the live description drifted"
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        pins = decision.context.get("pinned_descriptions") or {}
        if not pins:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        tools = decision.context.get("tools")
        if tools is not None:
            mismatches: list[str] = []
            for tool in tools:
                name = str(tool.get("name") or "")
                expected = pins.get(name)
                if expected is not None and tool.get("description") != expected:
                    mismatches.append(name)
                    tool["description"] = expected
                    tool["pinned_mismatch"] = True
            if mismatches:
                return ControlOutcome(
                    action=ControlAction.TRANSFORM,
                    payload=decision.payload,
                    control_id=self.id,
                    reason=f"pinned {len(mismatches)} drifted description(s)",
                    metadata={"mismatches": mismatches},
                )
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        name = str(decision.context.get("tool") or "")
        live = str(decision.context.get("tool_description") or "")
        expected = pins.get(name)
        if expected is not None and live and live != expected:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=f"tool {name!r} description does not match the pin",
                rejection_key="mcp_tool_pin_mismatch",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
