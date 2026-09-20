from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class ToolApprovalControl(DefenseControl):
    id = "tool.approval"
    name = "Tool approval"
    verifies = (
        "Tools marked requires_approval pause the run until the calling user "
        "approves or denies the exact action. Cross-user approval is refused."
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        if decision.context.get("requires_approval"):
            return ControlOutcome(
                action=ControlAction.REQUIRE_APPROVAL,
                payload=decision.payload,
                control_id=self.id,
                reason="tool requires human approval",
                rejection_key="tool_requires_approval",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
