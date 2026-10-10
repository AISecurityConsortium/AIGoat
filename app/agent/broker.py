"""Deterministic Intent Gate: schema, one repair, allowlist, approval, invoke."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.agent.schema import as_json_schema, validate_and_repair
from app.defense.chain import ChainResult, run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.profiles import resolve_profile
from app.defense.telemetry import TelemetryLogger
from app.services.tool_registry import ToolRegistry

_telemetry = TelemetryLogger()


@dataclass
class BrokerOutcome:
    action: ControlAction
    arguments: dict[str, Any]
    observation: dict[str, Any]
    control_id: str = ""
    reason: str | None = None
    invoked: bool = False
    outcomes: tuple = field(default_factory=tuple)


class IntentGate:
    """Planner output is untrusted. This object is the only path to a tool."""

    def __init__(
        self,
        registry: ToolRegistry,
        *,
        level: int,
        allowlist: list[str] | None = None,
        user_id: int | None = None,
        surface: str = "agent.runner",
    ) -> None:
        self.registry = registry
        self.level = level
        self.allowlist = allowlist
        self.user_id = user_id
        self.surface = surface

    def extra_context(self, tool: Any) -> dict[str, Any]:
        """Lab-supplied facts for the tool-call chain. Empty unless a host overrides it."""
        return {}

    async def dispatch(self, name: str, arguments: dict[str, Any] | None) -> BrokerOutcome:
        tool = self.registry.get(name)
        schema = as_json_schema(tool.parameter_schema if tool else {})
        if tool is None and not schema.get("properties"):
            schema = {"type": "object", "properties": {}, "additionalProperties": True}
        repaired, error, _did_repair = validate_and_repair(schema, arguments)
        if error:
            return BrokerOutcome(
                action=ControlAction.DENY,
                arguments=dict(arguments or {}),
                observation={"error": error},
                control_id="intent.gate",
                reason=error,
            )
        assert repaired is not None
        payload = json.dumps({"tool": name, "arguments": repaired}, default=str)

        if self.level <= 0:
            result = await self.registry.invoke(name, repaired)
            return BrokerOutcome(
                action=ControlAction.ALLOW,
                arguments=repaired,
                observation=result,
                invoked=True,
            )

        profile = resolve_profile(self.surface, self.level)
        tool_controls = [
            cid for cid in profile.controls
            if DefenseStage.TOOL_CALL in get_control(cid).applies_to
        ]
        decision = DefenseDecision(
            surface=self.surface,
            stage=DefenseStage.TOOL_CALL,
            payload=payload,
            level=self.level,
            context={
                "tool": name,
                "arguments": repaired,
                "allowlist": self.allowlist,
                "requires_approval": bool(tool and tool.requires_approval),
            },
            user_id=self.user_id,
        )
        decision.context.update(self.extra_context(tool))
        chain = await run_chain(tool_controls, decision)
        final = chain.final
        if final.action == ControlAction.DENY:
            return BrokerOutcome(
                action=ControlAction.DENY,
                arguments=repaired,
                observation={"error": final.reason or "tool call denied"},
                control_id=final.control_id,
                reason=final.reason,
                outcomes=chain.outcomes,
            )
        if final.action == ControlAction.REQUIRE_APPROVAL:
            return BrokerOutcome(
                action=ControlAction.REQUIRE_APPROVAL,
                arguments=repaired,
                observation={"status": "awaiting_approval"},
                control_id=final.control_id,
                reason=final.reason,
                outcomes=chain.outcomes,
            )
        result = await self.registry.invoke(name, repaired)
        return BrokerOutcome(
            action=ControlAction.ALLOW,
            arguments=repaired,
            observation=result,
            control_id=final.control_id,
            invoked=True,
            outcomes=chain.outcomes,
        )

    async def review_tool_result(self, observation: str) -> str:
        """Redact untrusted instructions before the result re-enters the planner."""
        if self.level <= 0 or not observation:
            return observation
        profile = resolve_profile(self.surface, self.level)
        controls = [
            cid for cid in profile.controls
            if DefenseStage.TOOL_RESULT in get_control(cid).applies_to
        ]
        if not controls:
            return observation
        decision = DefenseDecision(
            surface=self.surface,
            stage=DefenseStage.TOOL_RESULT,
            payload=observation,
            level=self.level,
            user_id=self.user_id,
        )
        chain = await run_chain(controls, decision)
        await _log_chain(self.user_id, self.level, observation, chain)
        return chain.final.payload


async def _log_chain(user_id: int | None, level: int, message: str, chain: ChainResult) -> None:
    action = "allowed"
    if chain.final.action == ControlAction.DENY:
        action = "blocked"
    elif chain.final.action == ControlAction.TRANSFORM or chain.final.payload != message:
        action = "transformed"
    elif chain.final.action == ControlAction.REQUIRE_APPROVAL:
        action = "approval"
    await _telemetry.log(
        user_id=user_id,
        level=level,
        message=message,
        intent=None,
        action=action,
        reason=chain.final.reason,
    )
