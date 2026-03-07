from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


_embedding_service: "EmbeddingService | None" = None


class EmbeddingService:
    def __init__(self, model_name: str | None = None) -> None:
        self._model_name = model_name or get_settings().rag.embedding_model
        self._model: "SentenceTransformer | None" = None

    def _load_model(self) -> "SentenceTransformer":
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def embed_text(self, text: str) -> list[float]:
        model = self._load_model()
        return model.encode(text, convert_to_numpy=True).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = self._load_model()
        embeddings = model.encode(texts, convert_to_numpy=True)
        return [emb.tolist() for emb in embeddings]

    async def embed_text_async(self, text: str) -> list[float]:
        return await asyncio.to_thread(self.embed_text, text)

    async def embed_batch_async(self, texts: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(self.embed_batch, texts)


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
