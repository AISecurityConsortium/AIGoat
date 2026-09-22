"""Drop stored agent notes that look like planted policy / injection (D5 L2)."""
from __future__ import annotations

import re

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.rag.injection_detector import detect_injection

_POLICY = (
    r"pre-approved",
    r"standing\s+(?:refund\s+)?policy",
    r"always\s+(?:issue\s+)?refund",
)


def is_poison_note(text: str) -> tuple[bool, str]:
    hit, reason = detect_injection(text or "")
    if hit:
        return True, reason
    blob = (text or "").lower()
    for pattern in _POLICY:
        if re.search(pattern, blob):
            return True, "stored refund policy"
    return False, ""


class MemoryScanControl(DefenseControl):
    id = "memory.scan"
    name = "Agent memory scan"
    verifies = (
        "recalled agent notes matching instruction-override or planted refund-policy "
        "phrasing are dropped from the prompt; the rows stay stored for the learner to inspect"
    )
    applies_to = (DefenseStage.MEMORY,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        notes = decision.context.setdefault("notes", [])
        excluded = 0
        for note in notes:
            hit, reason = is_poison_note(note.get("value") or note.get("raw") or "")
            if hit:
                note["included"] = False
                note["excluded_by_control"] = self.id
                note["scan_reason"] = reason
                excluded += 1
            else:
                note["included"] = True
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=decision.payload,
            control_id=self.id,
            reason=f"excluded {excluded} planted note(s)" if excluded else None,
            metadata={"excluded": excluded},
        )
