from __future__ import annotations

import hashlib


class HashEmbeddingService:
    """Deterministic embedder so RAG tests never load MiniLM."""

    dim = 32

    def embed_text(self, text: str) -> list[float]:
        seed = hashlib.sha256((text or "").encode()).digest()
        values: list[float] = []
        while len(values) < self.dim:
            seed = hashlib.sha256(seed).digest()
            values.extend(byte / 255.0 for byte in seed)
        return values[: self.dim]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(text) for text in texts]
