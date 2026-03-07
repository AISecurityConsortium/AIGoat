from __future__ import annotations

from dataclasses import dataclass

from app.core.logging import get_logger
from app.defense.input_validator import InputValidator
from app.defense.intent_classifier import IntentClassifier, IntentResult
from app.defense.output_moderator import OutputModerator
from app.defense.policy_engine import PolicyEngine
from app.defense.rejection import get_rejection_response
from app.defense.telemetry import TelemetryLogger

logger = get_logger(__name__)


@dataclass
class PipelineResult:
    allowed: bool
    message: str
    intent: IntentResult | None = None
    blocked_reason: str | None = None


class DefensePipeline:
    def __init__(self) -> None:
        self.input_validator = InputValidator()
        self.intent_classifier = IntentClassifier()
        self.policy_engine = PolicyEngine()
        self.output_moderator = OutputModerator()
        self.telemetry = TelemetryLogger()

    async def process_input(
        self, message: str, level: int, user_id: int | None = None
    ) -> PipelineResult:
        if level == 0:
            return PipelineResult(allowed=True, message=message)

        validated = self.input_validator.validate(message, level)
        if not validated.valid:
            await self.telemetry.log(
                user_id=user_id,
                level=level,
                message=message,
                intent=None,
                action="blocked",
                reason=validated.reason,
            )
            return PipelineResult(
                allowed=False,
                message=get_rejection_response("input_invalid"),
                blocked_reason=validated.reason,
            )

        cleaned = validated.cleaned_message

        if level >= 1:
            intent = self.intent_classifier.classify(cleaned)
            decision = self.policy_engine.evaluate(intent, level)
            if not decision.allowed:
                await self.telemetry.log(
                    user_id=user_id,
                    level=level,
                    message=message,
                    intent=intent.label,
                    action="blocked",
                    reason=decision.reason,
                )
                return PipelineResult(
                    allowed=False,
                    message=get_rejection_response(decision.rejection_key),
                    intent=intent,
                    blocked_reason=decision.reason,
                )
            await self.telemetry.log(
                user_id=user_id,
                level=level,
                message=message,
                intent=intent.label,
                action="allowed",
                reason=None,
            )
            return PipelineResult(allowed=True, message=cleaned, intent=intent)

        return PipelineResult(allowed=True, message=cleaned)

    async def moderate_output(self, response: str, level: int) -> str:
        return self.output_moderator.moderate(response, level)


defense_pipeline = DefensePipeline()
