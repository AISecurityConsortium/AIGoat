from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.output_moderator import OutputModerator

_moderator = OutputModerator()


class OutputModerateControl(DefenseControl):
    id = "output.moderate"
    name = "Output moderator"
    verifies = (
        "HTML, card numbers and emails are stripped at Level 1, output is "
        "truncated past 1000 characters, and Level 2 also strips code, URLs and "
        "system-prompt fragments"
    )
    applies_to = (DefenseStage.OUTPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        moderated = _moderator.moderate(decision.payload, decision.level)
        if moderated != decision.payload:
            return ControlOutcome(
                action=ControlAction.TRANSFORM,
                payload=moderated,
                control_id=self.id,
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=moderated,
            control_id=self.id,
        )
