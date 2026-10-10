from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.input_validator import InputValidator

_validator = InputValidator()


class InputValidateControl(DefenseControl):
    id = "input.validate"
    name = "Input validator"
    verifies = (
        "the message is within the level's length cap and contains no literal "
        "override phrase from the strip list"
    )
    applies_to = (DefenseStage.INPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        result = _validator.validate(decision.payload, decision.level)
        if not result.valid:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=result.cleaned_message,
                control_id=self.id,
                reason=result.reason,
                rejection_key="input_invalid",
            )
        if result.cleaned_message != decision.payload:
            return ControlOutcome(
                action=ControlAction.TRANSFORM,
                payload=result.cleaned_message,
                control_id=self.id,
                reason=result.reason,
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=result.cleaned_message,
            control_id=self.id,
        )
