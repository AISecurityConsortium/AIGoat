from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.token_utils import truncate_chunks_to_budget
from app.rag.embeddings import get_embedding_service
from app.rag.injection_detector import detect_injection
from app.rag.query_rewriter import rewrite_query
from app.rag.retrieval import RetrievalService
from app.services.chat_service import load_rag_prompt
from app.services.ollama_client import get_ollama_client

_rag_service: "RAGService | None" = None


class RAGService:
    def __init__(self) -> None:
        settings = get_settings()
        self._embedding = get_embedding_service()
        self._retrieval = RetrievalService(
            chroma_path=settings.rag.chroma_path,
            collection_name="product_knowledge",
        )
        self._top_k = settings.rag.top_k

    async def process_query(
        self,
        query: str,
        user: Any,
        use_kb: bool = True,
    ) -> dict:
        is_injection, reason = detect_injection(query)
        base_prompt = load_rag_prompt() or "You are a helpful AI assistant for an e-commerce shop."
        if use_kb:
            rewritten = rewrite_query(query)
            contexts = await self._retrieval.query_async(rewritten, top_k=self._top_k)
            raw_chunks = [c.get("content", "") for c in contexts if c.get("content")]
            max_tokens = get_settings().rag.max_context_tokens
            trimmed = truncate_chunks_to_budget(raw_chunks, max_tokens)
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
        }

    def get_stats(self) -> dict:
        doc_count = self._retrieval.count()
        return {
            "collection_count": doc_count,
            "top_k": self._top_k,
            "knowledge_base": {
                "total_documents": doc_count,
                "status": "active" if doc_count > 0 else "empty",
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
