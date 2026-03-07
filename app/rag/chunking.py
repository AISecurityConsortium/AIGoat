from __future__ import annotations

import re


def semantic_chunk(text: str, max_chunk_size: int = 512) -> list[str]:
    if not text or not text.strip():
        return []
    chunks: list[str] = []
    paragraphs = re.split(r"\n\s*\n", text.strip())
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(para) <= max_chunk_size:
            chunks.append(para)
            continue
        sentences = re.split(r"(?<=[.!?])\s+", para)
        current: list[str] = []
        current_len = 0
        for sent in sentences:
            sent_len = len(sent) + (1 if current else 0)
            if current_len + sent_len > max_chunk_size and current:
                chunks.append(" ".join(current))
                current = []
                current_len = 0
            if len(sent) > max_chunk_size:
                if current:
                    chunks.append(" ".join(current))
                    current = []
                    current_len = 0
                chunks.append(sent)
                continue
            current.append(sent)
            current_len += sent_len
        if current:
            chunks.append(" ".join(current))
    return chunks
