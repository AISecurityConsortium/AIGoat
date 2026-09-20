"""In-process BM25 index. Chroma local builds cannot store sparse vectors."""
from __future__ import annotations

from typing import Any


class Bm25Index:
    """Wraps bm25s with progress bars off so tests and the API stay quiet."""

    def __init__(self) -> None:
        self._ids: list[str] = []
        self._retriever: Any = None

    def rebuild(self, ids: list[str], texts: list[str]) -> None:
        self._ids = list(ids)
        self._retriever = None
        if not texts:
            return
        import bm25s

        retriever = bm25s.BM25()
        tokens = bm25s.tokenize(texts, show_progress=False)
        retriever.index(tokens, show_progress=False)
        self._retriever = retriever

    def query(self, query_text: str, top_k: int) -> list[tuple[str, float]]:
        if self._retriever is None or not self._ids or top_k <= 0 or not query_text.strip():
            return []
        import bm25s

        k = min(top_k, len(self._ids))
        query_tokens = bm25s.tokenize(query_text, show_progress=False)
        _indices, scores = self._retriever.retrieve(query_tokens, k=k, show_progress=False)
        row = _indices[0]
        score_row = scores[0]
        out: list[tuple[str, float]] = []
        for i, idx in enumerate(row):
            pos = int(idx)
            if pos < 0 or pos >= len(self._ids):
                continue
            out.append((self._ids[pos], float(score_row[i])))
        return out
