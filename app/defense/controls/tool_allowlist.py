from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class ToolAllowlistControl(DefenseControl):
    id = "tool.allowlist"
    name = "Tool allowlist"
    verifies = (
        "Tool names not in the lab's declared allowlist are denied before "
        "invocation. An empty or missing allowlist means every registered tool."
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        name = str(decision.context.get("tool") or "")
        allowlist = decision.context.get("allowlist")
        if allowlist is None:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        allowed = {str(item) for item in allowlist}
        if name not in allowed:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=f"tool {name!r} is not on the allowlist",
                rejection_key="tool_not_allowlisted",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
