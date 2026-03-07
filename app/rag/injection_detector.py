from __future__ import annotations

import re

INJECTION_PATTERNS = [
    (r"ignore\s+(?:all\s+)?(?:previous|prior|above|prior)\s+(?:instructions?|context|prompt)", "instruction override"),
    (r"disregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|context|documents?)", "context disregard"),
    (r"forget\s+(?:everything|all)\s+(?:you\s+)?(?:know|were\s+told)", "memory reset"),
    (r"you\s+are\s+now\s+(?:a\s+)?(?:different|new)\s+", "role confusion"),
    (r"system\s*:\s*", "system prompt injection"),
    (r"<\s*/\s*system\s*>", "delimiter injection"),
    (r"\[INST\]|\[\s*\/\s*INST\s*\]", "format injection"),
    (r"new\s+instructions?\s*:", "instruction override"),
    (r"override\s+(?:your|the)\s+", "override attempt"),
    (r"pretend\s+(?:you\s+are|to\s+be)\s+", "persona override"),
    (r"act\s+as\s+if\s+", "behavior override"),
    (r"from\s+now\s+on\s+", "behavior override"),
    (r"do\s+not\s+(?:follow|obey|use)\s+(?:your\s+)?(?:instructions?|rules?)", "rule bypass"),
]


def detect_injection(query: str) -> tuple[bool, str]:
    if not query or not query.strip():
        return False, ""
    q = query.strip().lower()
    for pattern, reason in INJECTION_PATTERNS:
        if re.search(pattern, q, re.IGNORECASE | re.DOTALL):
            return True, reason
    return False, ""
