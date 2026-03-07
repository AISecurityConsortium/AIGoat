from __future__ import annotations

import re

FILLER_WORDS = {
    "please", "kindly", "could you", "can you", "would you",
    "i want", "i need", "i would like", "tell me", "give me",
    "what is", "what are", "how do", "how does", "how can",
    "um", "uh", "like", "you know", "actually", "basically",
}


def rewrite_query(query: str) -> str:
    if not query or not query.strip():
        return query
    normalized = query.strip().lower()
    words = normalized.split()
    filtered: list[str] = []
    i = 0
    while i < len(words):
        w = words[i]
        span = " ".join(words[i:i+3]) if i + 3 <= len(words) else w
        matched = False
        for filler in sorted(FILLER_WORDS, key=len, reverse=True):
            if span.startswith(filler):
                skip = len(filler.split())
                i += skip
                matched = True
                break
        if not matched:
            filtered.append(words[i])
            i += 1
    result = " ".join(filtered)
    result = re.sub(r"\s+", " ", result).strip()
    return result if result else query.strip()
