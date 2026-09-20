"""Defense pipeline.

Public methods are thin adapters over the T062 control chain. New controls
are registered in ``app.defense.controls`` and listed in
``config/defense_profiles.yml`` — this module does not name them.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.intent_classifier import IntentResult
from app.defense.profiles import resolve_profile
from app.defense.rejection import get_rejection_response
from app.defense.telemetry import TelemetryLogger


@dataclass
class PipelineResult:
    allowed: bool
    message: str
    intent: IntentResult | None = None
    blocked_reason: str | None = None
    outcomes: tuple = ()


def _input_control_ids(profile) -> tuple[str, ...]:
    return tuple(
        cid for cid in profile.controls
        if DefenseStage.INPUT in get_control(cid).applies_to
    )


def _output_control_ids(profile) -> tuple[str, ...]:
    return tuple(
        cid for cid in profile.controls
        if DefenseStage.OUTPUT in get_control(cid).applies_to
    )


def _intent_from_outcomes(outcomes) -> IntentResult | None:
    for outcome in reversed(outcomes):
        result = outcome.metadata.get("intent_result")
        if result is not None:
            return result
    return None


class DefensePipeline:
    def __init__(self) -> None:
        self.telemetry = TelemetryLogger()

    async def process_input(
        self,
        message: str,
        level: int,
        user_id: int | None = None,
        surface: str = "chat.cracky",
    ) -> PipelineResult:
        if level == 0:
            return PipelineResult(allowed=True, message=message)

        profile = resolve_profile(surface, level)
        decision = DefenseDecision(
            surface=surface,
            stage=DefenseStage.INPUT,
            payload=message,
            level=level,
            user_id=user_id,
        )
        chain = await run_chain(_input_control_ids(profile), decision)
        intent = _intent_from_outcomes(chain.outcomes)

        if chain.final.action in (ControlAction.DENY, ControlAction.REQUIRE_APPROVAL):
            await self.telemetry.log(
                user_id=user_id,
                level=level,
                message=message,
                intent=intent.label if intent else None,
                action="blocked",
                reason=chain.final.reason,
            )
            key = chain.final.rejection_key or "default"
            return PipelineResult(
                allowed=False,
                message=get_rejection_response(key),
                intent=intent,
                blocked_reason=chain.final.reason,
                outcomes=chain.outcomes,
            )

        await self.telemetry.log(
            user_id=user_id,
            level=level,
            message=message,
            intent=intent.label if intent else None,
            action="allowed",
            reason=None,
        )
        return PipelineResult(
            allowed=True,
            message=chain.final.payload,
            intent=intent,
            outcomes=chain.outcomes,
        )

    async def moderate_output(self, response: str, level: int, surface: str = "chat.cracky") -> str:
        if level == 0:
            return response
        profile = resolve_profile(surface, level)
        decision = DefenseDecision(
            surface=surface,
            stage=DefenseStage.OUTPUT,
            payload=response,
            level=level,
        )
        chain = await run_chain(_output_control_ids(profile), decision)
        return chain.final.payload


defense_pipeline = DefensePipeline()
