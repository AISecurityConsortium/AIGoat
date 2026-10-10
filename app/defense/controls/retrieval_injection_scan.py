from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.rag.injection_detector import detect_injection


class RetrievalInjectionScanControl(DefenseControl):
    id = "retrieval.injection_scan"
    name = "Retrieval injection scan"
    verifies = (
        "retrieved chunks matching known instruction-override patterns are "
        "dropped from the context before generation"
    )
    applies_to = (DefenseStage.RETRIEVAL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        candidates = decision.context.setdefault("candidates", [])
        excluded = 0
        for cand in candidates:
            hit, reason = detect_injection(cand.get("content") or "")
            if hit:
                cand["excluded_by_control"] = self.id
                cand["included_in_context"] = False
                excluded += 1
                cand["injection_reason"] = reason
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=decision.payload,
            control_id=self.id,
            reason=f"excluded {excluded} injected chunk(s)" if excluded else None,
            metadata={"excluded": excluded},
        )
