from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.nemo_guardrails import get_guardrails_service


class RailsNemoControl(DefenseControl):
    id = "rails.nemo"
    name = "NeMo Guardrails"
    verifies = (
        "when nemoguardrails is installed and initialised, the input rail is "
        "consulted; when the package is absent the control is a no-op allow, "
        "matching CI"
    )
    applies_to = (DefenseStage.INPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        nemo = get_guardrails_service()
        if not nemo.available:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
                metadata={"nemo_available": False},
            )
        result = await nemo.check_input(decision.payload)
        if not result.allowed:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=result.message,
                control_id=self.id,
                reason=result.blocked_reason,
                rejection_key=result.blocked_reason or "default",
                metadata={"nemo_available": True},
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata={"nemo_available": True},
        )
