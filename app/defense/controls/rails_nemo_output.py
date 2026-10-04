"""NeMo output rail, with a deterministic fallback when the package is absent."""
from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.nemo_fallback import check_output
from app.defense.nemo_guardrails import get_guardrails_service


class RailsNemoOutputControl(DefenseControl):
    id = "rails.nemo_output"
    name = "NeMo output rail"
    verifies = (
        "the final answer is checked for PII, prompt leaks, and off-topic claims; "
        "when nemoguardrails is absent the same checks run locally and the outcome "
        "records engine nemo or fallback"
    )
    applies_to = (DefenseStage.OUTPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        nemo = get_guardrails_service()
        if nemo.available:
            result = await nemo.check_output(decision.payload)
            engine = "nemo"
            allowed = result.allowed
            message = result.message
            reason = result.blocked_reason
        else:
            allowed, message, reason = check_output(decision.payload)
            engine = "fallback"
        if not allowed:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=message,
                control_id=self.id,
                reason=reason,
                rejection_key=reason or "default",
                metadata={"engine": engine, "nemo_available": nemo.available},
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata={"engine": engine, "nemo_available": nemo.available},
        )
