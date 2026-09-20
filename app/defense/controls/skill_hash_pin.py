from __future__ import annotations

import hashlib

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class SkillHashPinControl(DefenseControl):
    id = "skill.hash_pin"
    name = "Skill content-hash pin"
    verifies = (
        "A lab-pinned SKILL.md body or hash must match the file on disk. "
        "Drifted instructions are denied at Level 2."
    )
    applies_to = (DefenseStage.SKILL_LOAD,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        current = str(decision.context.get("content_hash") or "")
        pinned_hash = decision.context.get("pinned_hash")
        pinned_body = decision.context.get("pinned_body")
        if pinned_body and not pinned_hash:
            pinned_hash = hashlib.sha256(str(pinned_body).encode("utf-8")).hexdigest()
        if not pinned_hash:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        if current != str(pinned_hash):
            decision.context["pinned_mismatch"] = True
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason="SKILL.md hash does not match the lab pin",
                rejection_key="skill_hash_mismatch",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
