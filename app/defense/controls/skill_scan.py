from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_NEEDLES = (
    "os.system",
    "eval(",
    "exec(",
    "subprocess",
    "__import__",
)


class SkillScanControl(DefenseControl):
    id = "skill.scan"
    name = "Naive skill-body scanner"
    verifies = (
        "Obvious host-sink spellings in SKILL.md are denied. Ordinary prose "
        "that names a shop tool is intentionally missed (AST08)."
    )
    applies_to = (DefenseStage.SKILL_LOAD,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        lower = (decision.payload or "").lower()
        hit = next((needle for needle in _NEEDLES if needle in lower), None)
        if hit:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=f"skill body matched sink needle {hit!r}",
                rejection_key="skill_scan_hit",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
