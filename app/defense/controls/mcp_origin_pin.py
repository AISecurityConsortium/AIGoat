"""Bind an approved tool to the integration that is allowed to serve it.

Description pinning cannot see this. A lookalike can copy the approved name and
description and still be a different process. The pin is lab-supplied. With no
pin the control allows, so labs that do not set one are unchanged.
"""
from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_DENY_REASON = "Call denied: this tool is not being served by its approved integration."


class McpOriginPinControl(DefenseControl):
    id = "mcp.origin_pin"
    name = "MCP tool origin pin"
    verifies = (
        "a tools/call is denied before it runs when the serving integration "
        "is not the one the lab approved for that tool"
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        pins = decision.context.get("pinned_origins") or {}
        if not isinstance(pins, dict) or not pins:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        name = str(decision.context.get("tool") or "")
        expected = pins.get(name)
        if not expected:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        origin = str(decision.context.get("tool_origin") or "")
        if origin and origin != str(expected):
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=_DENY_REASON,
                rejection_key="mcp_origin_pin_mismatch",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
