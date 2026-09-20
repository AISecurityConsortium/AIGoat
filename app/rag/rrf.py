"""Reciprocal rank fusion for hybrid dense + BM25 retrieval.

ChromaDB's native RRF is Cloud-only. k=60 is the standard constant from
Cormack, Clarke & Buettcher (2009).
"""
from __future__ import annotations


def rrf_scores(rankings: list[list[str]], k: int = 60) -> dict[str, float]:
    """Fuse ranked id lists. Earlier ranks contribute more; unseen ids score 0."""
    scores: dict[str, float] = {}
    if k <= 0:
        raise ValueError("rrf k must be > 0")
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return scores


def rrf_order(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores = rrf_scores(rankings, k=k)
    return sorted(scores.keys(), key=lambda doc_id: scores[doc_id], reverse=True)
