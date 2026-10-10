from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.nemo_fallback import check_input
from app.defense.nemo_guardrails import get_guardrails_service


class RailsNemoControl(DefenseControl):
    id = "rails.nemo"
    name = "NeMo Guardrails"
    verifies = (
        "when nemoguardrails is installed and initialised, the input rail is "
        "consulted; when the package is absent a deterministic local check runs "
        "instead of a silent allow, and the outcome records engine nemo or fallback"
    )
    applies_to = (DefenseStage.INPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        nemo = get_guardrails_service()
        if nemo.available:
            result = await nemo.check_input(decision.payload)
            allowed = result.allowed
            message = result.message if not result.allowed else decision.payload
            reason = result.blocked_reason
            engine = "nemo"
        else:
            allowed, message, reason = check_input(decision.payload, decision.level)
            engine = "fallback"
        metadata = {"engine": engine, "nemo_available": nemo.available}
        if not allowed:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=message,
                control_id=self.id,
                reason=reason,
                rejection_key=reason or "default",
                metadata=metadata,
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata=metadata,
        )
