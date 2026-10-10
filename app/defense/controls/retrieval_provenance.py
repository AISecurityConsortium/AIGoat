from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.rag.retrieval import citations_from_candidates


class RetrievalProvenanceControl(DefenseControl):
    id = "retrieval.provenance"
    name = "Retrieval provenance"
    verifies = (
        "each retrieved chunk carries chunk_id, source title, score and trust "
        "tier, and citations quote an exact substring of the chunk"
    )
    applies_to = (DefenseStage.RETRIEVAL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        candidates = decision.context.setdefault("candidates", [])
        for cand in candidates:
            cand["provenance"] = {
                "chunk_id": cand.get("chunk_id"),
                "title": cand.get("title") or "",
                "trust_tier": cand.get("trust_tier") or "user",
                "dense_score": cand.get("dense_score"),
                "bm25_score": cand.get("bm25_score"),
                "rrf_score": cand.get("rrf_score"),
            }
        citations = citations_from_candidates(candidates)
        decision.context["citations"] = citations
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata={"citation_count": len(citations)},
        )
