from __future__ import annotations

import re

HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
CREDIT_CARD_PATTERN = re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b")
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
CODE_BLOCK_PATTERN = re.compile(r"```[\s\S]*?```")
INLINE_CODE_PATTERN = re.compile(r"`[^`]+`")
URL_PATTERN = re.compile(
    r"https?://[^\s]+|www\.[^\s]+",
    re.I,
)
SYSTEM_PROMPT_FRAGMENTS = [
    "you are",
    "your instructions",
    "system prompt",
    "assistant is",
]


class OutputModerator:
    def moderate(self, response: str, level: int) -> str:
        if level == 0:
            return response

        result = response

        if level >= 1:
            result = HTML_TAG_PATTERN.sub("", result)
            result = CREDIT_CARD_PATTERN.sub("****", result)
            result = EMAIL_PATTERN.sub("***@***.***", result)

        if level >= 2:
            result = CODE_BLOCK_PATTERN.sub("", result)
            result = INLINE_CODE_PATTERN.sub("", result)
            result = URL_PATTERN.sub("", result)
            result = re.sub(r"\s+", " ", result).strip()
            result_lower = result.lower()
            for fragment in SYSTEM_PROMPT_FRAGMENTS:
                if fragment in result_lower:
                    return "I'm sorry, I can only help with AI Goat Shop products and orders."

        return result
