from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class SkillAllowlistControl(DefenseControl):
    id = "skill.allowlist"
    name = "Skill declared-tool allowlist"
    verifies = (
        "Tools granted to an installed skill are limited to the SKILL.md "
        "allowed-tools list. Level 0 does not run this control."
    )
    applies_to = (DefenseStage.SKILL_LOAD,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        declared = [str(item) for item in (decision.context.get("declared_tools") or [])]
        decision.context["granted_tools"] = declared
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=decision.payload,
            control_id=self.id,
            reason="granted tools restricted to allowed-tools",
            metadata={"granted_tools": declared},
        )
