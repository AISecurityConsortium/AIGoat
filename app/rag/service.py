from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.token_utils import truncate_chunks_to_budget
from app.defense.chain import run_chain
from app.defense.control import DefenseDecision, DefenseStage, get_control
from app.defense.profiles import resolve_profile
from app.rag.embeddings import get_embedding_service
from app.rag.injection_detector import detect_injection
from app.rag.query_rewriter import rewrite_query
from app.rag.retrieval import (
    RetrievalService,
    apply_token_budget,
    citations_from_candidates,
)
from app.services.chat_service import load_rag_prompt
from app.services.ollama_client import get_ollama_client

_rag_service: RAGService | None = None


def _retrieval_control_ids(profile) -> tuple[str, ...]:
    return tuple(
        cid for cid in profile.controls
        if DefenseStage.RETRIEVAL in get_control(cid).applies_to
    )


class RAGService:
    def __init__(self) -> None:
        settings = get_settings()
        self._embedding = get_embedding_service()
        self._retrieval = RetrievalService(
            chroma_path=settings.rag.chroma_path,
            collection_name="product_knowledge",
        )
        self._top_k = settings.rag.top_k
        self._last_sync_at: datetime | None = None

    def mark_synced(self) -> None:
        self._last_sync_at = datetime.now(timezone.utc)

    async def retrieve_trace(
        self,
        query: str,
        *,
        user_id: int | None,
        level: int,
        top_k: int | None = None,
        hybrid: bool | None = None,
        surface: str = "rag.kb",
    ) -> dict[str, Any]:
        rewritten = rewrite_query(query)
        k = top_k if top_k is not None else self._top_k
        candidates = await self._retrieval.retrieve_async(
            rewritten,
            top_k=k,
            hybrid=hybrid,
        )
        profile = resolve_profile(surface, level) if level >= 1 else None
        retrieval_ids = _retrieval_control_ids(profile) if profile else ()
        decision = DefenseDecision(
            surface=surface,
            stage=DefenseStage.RETRIEVAL,
            payload=rewritten,
            level=level,
            user_id=user_id,
            context={"candidates": candidates, "query": query, "rewritten_query": rewritten},
        )
        chain = await run_chain(retrieval_ids, decision)
        candidates = list(decision.context.get("candidates") or candidates)
        budget = apply_token_budget(candidates, get_settings().rag.max_context_tokens)
        controls_applied = list(profile.controls) if profile else []
        citations: list[dict[str, Any]] = []
        if profile and "retrieval.provenance" in profile.controls:
            citations = citations_from_candidates(candidates)
            decision.context["citations"] = citations
        return {
            "query": query,
            "rewritten_query": rewritten,
            "top_k": k,
            "candidates": candidates,
            "token_budget": budget,
            "controls_applied": controls_applied,
            "citations": citations,
            "outcomes": chain.outcomes,
        }

    async def process_query(
        self,
        query: str,
        user: Any,
        use_kb: bool = True,
        *,
        level: int = 0,
        top_k: int | None = None,
        hybrid: bool | None = None,
    ) -> dict:
        is_injection, reason = detect_injection(query)
        base_prompt = load_rag_prompt() or "You are a helpful AI assistant for an e-commerce shop."
        contexts: list[dict] = []
        citations: list[dict] = []
        trace: dict[str, Any] | None = None
        if use_kb and get_settings().rag.enabled:
            user_id = getattr(user, "id", None)
            trace = await self.retrieve_trace(
                query,
                user_id=user_id,
                level=level,
                top_k=top_k,
                hybrid=hybrid,
            )
            candidates = trace["candidates"]
            contexts = [c for c in candidates if c.get("included_in_context")]
            citations = list(trace.get("citations") or [])
            raw_chunks = [c.get("content", "") for c in contexts if c.get("content")]
            trimmed = truncate_chunks_to_budget(raw_chunks, get_settings().rag.max_context_tokens)
            context_bloc = "\n\n".join(trimmed)
            system = f"{base_prompt}\n\nContext:\n{context_bloc}"
        else:
            system = base_prompt
        settings = get_settings()
        options = {
            "temperature": settings.chat.temperature,
            "top_p": settings.chat.top_p,
            "top_k": settings.chat.top_k,
            "num_predict": settings.chat.max_tokens,
        }
        client = get_ollama_client()
        reply = await client.chat(
            messages=[{"role": "user", "content": query}],
            system=system,
            options=options,
        )
        return {
            "reply": reply or "I couldn't process that request.",
            "use_kb": use_kb,
            "injection_detected": is_injection,
            "injection_reason": reason if is_injection else None,
            "contexts": contexts,
            "citations": citations,
            "trace": trace,
        }

    def get_stats(self, db_documents: int = 0) -> dict:
        indexed_chunks = self._retrieval.count()
        in_sync = db_documents > 0 and indexed_chunks > 0
        last = self._last_sync_at.isoformat() if self._last_sync_at else None
        return {
            "db_documents": db_documents,
            "indexed_chunks": indexed_chunks,
            "collection_count": indexed_chunks,
            "in_sync": in_sync,
            "last_sync_at": last,
            "top_k": self._top_k,
            "knowledge_base": {
                "total_documents": db_documents,
                "status": "active" if db_documents > 0 else "empty",
            },
            "chat_sessions": {
                "user_sessions": 0,
                "total_sessions": 0,
            },
        }


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


def reset_rag_service() -> None:
    """Tests only. Drop the singleton so chroma_path / embedder overrides apply."""
    global _rag_service
    _rag_service = None
