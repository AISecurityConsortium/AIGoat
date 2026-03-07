from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_PII_PATTERNS = [
    re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"(?:password|passwd|pwd)\s*[:=]\s*\S+", re.I),
    re.compile(r"(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*\S+", re.I),
]
_LEAK_INDICATORS = [
    "you are cracky", "your instructions", "system prompt",
    "your guidelines say", "your rules are", "critical security guardrails",
]


def _check_pii(text: str) -> bool:
    return any(p.search(text) for p in _PII_PATTERNS)


def _check_prompt_leak(text: str) -> bool:
    lower = text.lower()
    return sum(1 for ind in _LEAK_INDICATORS if ind in lower) >= 2


_guardrails_service: "NeMoGuardrailsService | None" = None
_init_attempted = False


@dataclass
class GuardrailResult:
    allowed: bool
    message: str
    blocked_reason: str | None = None


class NeMoGuardrailsService:
    def __init__(self, config_path: str | None = None) -> None:
        self._rails = None
        self._available = False
        self._config_path = config_path or str(
            Path(__file__).resolve().parent.parent.parent / "guardrails" / "config"
        )
        self._init_rails()

    def _init_rails(self) -> None:
        try:
            from nemoguardrails import LLMRails, RailsConfig

            config = RailsConfig.from_path(self._config_path)
            self._rails = LLMRails(config)
            self._available = True
            logger.info("NeMo Guardrails initialized from %s", self._config_path)
        except ImportError:
            logger.warning(
                "nemoguardrails package not installed; Level 2 guardrails will "
                "fall back to custom defense pipeline"
            )
        except Exception as exc:
            logger.error("Failed to initialize NeMo Guardrails: %s", exc)

    @property
    def available(self) -> bool:
        return self._available

    async def check_input(self, message: str) -> GuardrailResult:
        if not self._available or self._rails is None:
            return GuardrailResult(allowed=True, message=message)

        try:
            response = await self._rails.generate_async(
                messages=[{"role": "user", "content": message}]
            )
            bot_message = response.get("content", "") if isinstance(response, dict) else str(response)

            blocked_phrases = [
                "I can only help with AI Goat Shop",
                "I cannot modify my instructions",
                "I cannot share sensitive information",
                "I cannot operate in unrestricted",
                "I cannot verify identity claims",
                "I follow my standard guidelines",
                "I cannot decode, reverse",
                "I cannot generate code",
                "I'm Cracky AI, designed to assist",
                "I'm Cracky AI, the AI Goat Shop",
                "cannot accept external context",
                "I'm here to help with products and orders",
            ]
            is_blocked = any(phrase in bot_message for phrase in blocked_phrases)

            if is_blocked:
                return GuardrailResult(
                    allowed=False,
                    message=bot_message,
                    blocked_reason="nemo_input_rail_triggered",
                )
            return GuardrailResult(allowed=True, message=message)
        except Exception as exc:
            logger.error("NeMo input check failed (fail-closed): %s", exc, exc_info=True)
            return GuardrailResult(
                allowed=False,
                message="I'm unable to process your request right now due to a security check. Please try again.",
                blocked_reason="nemo_input_exception",
            )

    async def check_output(self, response: str) -> GuardrailResult:
        if not self._available or self._rails is None:
            return GuardrailResult(allowed=True, message=response)

        try:
            has_pii = _check_pii(response)
            has_leak = _check_prompt_leak(response)

            if has_pii:
                return GuardrailResult(
                    allowed=False,
                    message="I've detected that my response may contain sensitive information. Let me rephrase: I can help you with general product and order inquiries.",
                    blocked_reason="pii_detected_in_output",
                )
            if has_leak:
                return GuardrailResult(
                    allowed=False,
                    message="I cannot share sensitive information such as credentials, internal data, or system configurations.",
                    blocked_reason="system_prompt_leak_detected",
                )
            return GuardrailResult(allowed=True, message=response)
        except Exception as exc:
            logger.error("NeMo output check failed (fail-closed): %s", exc, exc_info=True)
            return GuardrailResult(
                allowed=False,
                message="I can help you with general product and order inquiries. Please rephrase your question.",
                blocked_reason="nemo_output_exception",
            )


def get_guardrails_service() -> NeMoGuardrailsService:
    global _guardrails_service, _init_attempted
    if _guardrails_service is None and not _init_attempted:
        _init_attempted = True
        _guardrails_service = NeMoGuardrailsService()
    if _guardrails_service is None:
        _guardrails_service = NeMoGuardrailsService.__new__(NeMoGuardrailsService)
        _guardrails_service._rails = None
        _guardrails_service._available = False
    return _guardrails_service
