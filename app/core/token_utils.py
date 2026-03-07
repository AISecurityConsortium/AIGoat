"""Centralized token estimation and context budget enforcement.

Used by both the chat and RAG paths to prevent context window overflow.
Word-based estimator avoids adding a tokenizer dependency while providing
a conservative upper bound (~1.33 tokens per word for English text).
"""
from __future__ import annotations

import math


def estimate_tokens(text: str) -> int:
    """Return an approximate token count for the given text.

    Uses a 1 token per 0.75 words heuristic (conservative for English).
    """
    word_count = len(text.split())
    return math.ceil(word_count / 0.75)


def truncate_chunks_to_budget(chunks: list[str], max_tokens: int) -> list[str]:
    """Keep chunks (in retrieval-score order) until the token budget is exhausted.

    Returns the prefix of chunks that fit within *max_tokens*.
    """
    kept: list[str] = []
    used = 0
    for chunk in chunks:
        cost = estimate_tokens(chunk)
        if used + cost > max_tokens and kept:
            break
        kept.append(chunk)
        used += cost
    return kept
