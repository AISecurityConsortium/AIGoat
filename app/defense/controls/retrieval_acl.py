from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage


class RetrievalAclControl(DefenseControl):
    id = "retrieval.acl"
    name = "Retrieval ACL"
    verifies = (
        "chunks whose owner_id is set and does not match the requesting user "
        "are excluded from the prompt context"
    )
    applies_to = (DefenseStage.RETRIEVAL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        candidates = decision.context.setdefault("candidates", [])
        user_id = decision.user_id
        excluded = 0
        for cand in candidates:
            owner = cand.get("owner_id")
            if owner is None:
                continue
            if user_id is None or int(owner) != int(user_id):
                cand["excluded_by_control"] = self.id
                cand["included_in_context"] = False
                excluded += 1
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=decision.payload,
            control_id=self.id,
            reason=f"excluded {excluded} unauthorized chunk(s)" if excluded else None,
            metadata={"excluded": excluded},
        )
