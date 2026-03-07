from __future__ import annotations

import base64
import re
from dataclasses import dataclass

LEVEL1_INJECTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"ignore\s+previous\s+instructions", re.I), ""),
    (re.compile(r"ignore\s+all\s+rules", re.I), ""),
    (re.compile(r"you\s+are\s+now", re.I), ""),
    (re.compile(r"forget\s+your", re.I), ""),
]

LEVEL2_INJECTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"translate\s+(?:the\s+)?following\s*:.*ignore", re.I | re.DOTALL), ""),
    (re.compile(r"decode\s+(?:the\s+)?following\s*:.*ignore", re.I | re.DOTALL), ""),
    (re.compile(r"process\s+(?:the\s+)?following\s*:.*ignore", re.I | re.DOTALL), ""),
]

BASE64_PATTERN = re.compile(r"[A-Za-z0-9+/]{40,}={0,2}")
UNICODE_OBFUSCATION = re.compile(r"[\u200b-\u200f\u2028-\u202f\ufeff]")

MAX_CHARS_L1 = 2000
MAX_CHARS_L2 = 1000


@dataclass
class ValidationResult:
    valid: bool
    cleaned_message: str
    reason: str | None = None


def _strip_level1_injections(text: str) -> tuple[str, bool]:
    result = text
    stripped = False
    for pattern, _ in LEVEL1_INJECTION_PATTERNS:
        before_len = len(result)
        result = pattern.sub("", result)
        if len(result) < before_len:
            stripped = True
    return re.sub(r"\s+", " ", result).strip(), stripped


def _strip_level2_injections(text: str) -> tuple[str, bool]:
    result, stripped1 = _strip_level1_injections(text)
    for pattern, _ in LEVEL2_INJECTION_PATTERNS:
        before_len = len(result)
        result = pattern.sub("", result)
        if len(result) < before_len:
            stripped1 = True
    return re.sub(r"\s+", " ", result).strip(), stripped1


def _is_base64_payload(text: str) -> bool:
    matches = BASE64_PATTERN.findall(text)
    for m in matches:
        try:
            decoded = base64.b64decode(m, validate=True)
            if len(decoded) > 20 and any(32 <= b < 127 for b in decoded[:50]):
                return True
        except Exception:
            pass
    return False


def _has_unicode_obfuscation(text: str) -> bool:
    return bool(UNICODE_OBFUSCATION.search(text))


class InputValidator:
    def validate(self, message: str, level: int) -> ValidationResult:
        if level < 1:
            return ValidationResult(valid=True, cleaned_message=message.strip())

        max_chars = MAX_CHARS_L2 if level >= 2 else MAX_CHARS_L1
        if len(message) > max_chars:
            return ValidationResult(
                valid=False,
                cleaned_message=message[:max_chars],
                reason="message_too_long",
            )

        cleaned, had_injection = _strip_level1_injections(message)
        if had_injection or not cleaned or len(cleaned) < 3:
            return ValidationResult(
                valid=False,
                cleaned_message=cleaned,
                reason="injection_detected",
            )

        if level >= 2:
            if _has_unicode_obfuscation(cleaned):
                return ValidationResult(
                    valid=False,
                    cleaned_message=cleaned,
                    reason="unicode_obfuscation",
                )
            if _is_base64_payload(cleaned):
                return ValidationResult(
                    valid=False,
                    cleaned_message=cleaned,
                    reason="base64_payload",
                )
            cleaned, had_nested = _strip_level2_injections(message)
            if had_nested or not cleaned or len(cleaned) < 3:
                return ValidationResult(
                    valid=False,
                    cleaned_message=cleaned,
                    reason="nested_injection",
                )

        return ValidationResult(valid=True, cleaned_message=cleaned)
