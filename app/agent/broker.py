"""Deterministic Intent Gate: schema, one repair, allowlist, approval, invoke."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.agent.schema import as_json_schema, validate_and_repair
from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.profiles import resolve_profile
from app.services.tool_registry import ToolRegistry


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
