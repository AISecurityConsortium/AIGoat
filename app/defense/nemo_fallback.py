"""Deterministic checks used when NeMo Guardrails is not installed.

The fallback mirrors the input classifier and the output PII / prompt-leak
checks so Level 2 still blocks known phrases in CI. It does not call the model.
"""
from __future__ import annotations

import re

from app.defense.intent_classifier import IntentClassifier
from app.defense.nemo_guardrails import _check_pii, _check_prompt_leak
from app.defense.policy_engine import PolicyEngine
from app.defense.rejection import get_rejection_response

_classifier = IntentClassifier()
_policy = PolicyEngine()

# Phrases the Colang agent flows name, beyond the shared intent patterns.
_EXTRA_INPUT: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"bypass\s+(?:the\s+)?approval", re.I), "injection"),
    (re.compile(r"skip\s+(?:the\s+)?approval", re.I), "injection"),
    (re.compile(r"approve\s+it\s+yourself", re.I), "injection"),
    (re.compile(r"i\s+am\s+the\s+(?:upstream|other)\s+agent", re.I), "social_engineering"),
    (re.compile(r"impersonat(?:e|ing)\s+(?:the\s+)?(?:admin|other)\s+agent", re.I), "social_engineering"),
    (re.compile(r"fan\s+out\s+to\s+every", re.I), "resource_abuse"),
    (re.compile(r"repeat\s+this\s+for\s+every", re.I), "resource_abuse"),
)

_PII_MESSAGE = (
    "I've detected that my response may contain sensitive information. "
    "Let me rephrase: I can help you with general product and order inquiries."
)
_LEAK_MESSAGE = (
    "I cannot share sensitive information such as credentials, internal data, "
    "or system configurations."
)
_OFF_TOPIC_MESSAGE = (
    "I should stay focused on AI Goat Shop topics. How can I help you with our products or orders?"
)

_SHOP_TOPICS = (
    "product", "order", "shop", "price", "refund", "return", "shipping",
    "coupon", "discount", "support", "review", "customer", "ticket", "catalog",
)


def check_input(message: str, level: int) -> tuple[bool, str, str | None]:
    """Return allowed, replacement-or-original text, and a reason when blocked."""
    intent = _classifier.classify(message)
    decision = _policy.evaluate(intent, level)
    if not decision.allowed:
        return False, get_rejection_response(decision.rejection_key), decision.reason
    for pattern, key in _EXTRA_INPUT:
        if pattern.search(message or ""):
            return False, get_rejection_response(key), f"{key}_detected"
    return True, message, None


def check_sensitive(text: str) -> tuple[bool, str, str | None]:
    """PII and prompt-leak only. Safe to run on tool results."""
    if _check_pii(text or ""):
        return False, _PII_MESSAGE, "pii_detected_in_output"
    if _check_prompt_leak(text or ""):
        return False, _LEAK_MESSAGE, "system_prompt_leak_detected"
    return True, text or "", None


def check_output(text: str) -> tuple[bool, str, str | None]:
    """PII, prompt-leak, and long off-topic answers. Short shop answers pass."""
    allowed, message, reason = check_sensitive(text)
    if not allowed:
        return False, message, reason
    body = text or ""
    lower = body.lower()
    on_topic = any(topic in lower for topic in _SHOP_TOPICS)
    if not on_topic and len(body) > 100:
        return False, _OFF_TOPIC_MESSAGE, "off_topic"
    return True, body, None
