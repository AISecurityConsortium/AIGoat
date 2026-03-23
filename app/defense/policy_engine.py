from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.defense.intent_classifier import IntentResult

BLOCKING_INTENTS = frozenset({
    "INJECTION", "EXTRACTION", "JAILBREAK",
    "SOCIAL_ENGINEERING", "CONTEXT_MANIPULATION",
    "ENCODING_EVASION", "CODE_GENERATION",
    "RESOURCE_ABUSE",
})


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str | None
    rejection_key: str


def _intent_to_rejection_key(label: str) -> str:
    return label.lower()


def _threshold_for_level(level: int) -> float:
    settings = get_settings()
    if level >= 2:
        return settings.defense.l2_confidence_threshold
    return settings.defense.l1_confidence_threshold


class PolicyEngine:
    def evaluate(self, intent: IntentResult, level: int) -> PolicyDecision:
        if level < 1:
            return PolicyDecision(allowed=True, reason=None, rejection_key="default")

        if intent.label not in BLOCKING_INTENTS:
            return PolicyDecision(allowed=True, reason=None, rejection_key="default")

        threshold = _threshold_for_level(level)
        if intent.confidence > threshold:
            return PolicyDecision(
                allowed=False,
                reason=f"{intent.label.lower()}_detected",
                rejection_key=_intent_to_rejection_key(intent.label),
            )

        return PolicyDecision(allowed=True, reason=None, rejection_key="default")
