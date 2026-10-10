"""Pin an approved input contract. Distinct from mcp.tool_pin, which pins description text.

The contract is a map of tool name to an object with ``properties``. Today the
check compares argument keys. The same object can later grow types, required
fields, and constraints without folding that into description pinning.
"""
from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_DENY_REASON = "Call denied: argument is not part of the approved tool schema."


def approved_argument_names(contract: object) -> set[str] | None:
    """Names the approved input contract allows. None when this tool has no contract."""
    if not isinstance(contract, dict):
        return None
    properties = contract.get("properties")
    if not isinstance(properties, dict):
        return None
    return {str(name) for name in properties}


class McpSchemaPinControl(DefenseControl):
    id = "mcp.schema_pin"
    name = "MCP input schema pin"
    verifies = (
        "a tools/call whose arguments are outside the approved input contract "
        "is denied before the server runs"
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        schemas = decision.context.get("pinned_schemas") or {}
        if decision.context.get("op") != "call" or not isinstance(schemas, dict) or not schemas:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        approved = approved_argument_names(schemas.get(str(decision.context.get("tool") or "")))
        if approved is None:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        arguments = decision.context.get("arguments") if isinstance(decision.context.get("arguments"), dict) else {}
        extra = [str(key) for key in arguments if str(key) not in approved]
        if extra:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=_DENY_REASON,
                rejection_key="mcp_schema_pin_mismatch",
                metadata={"arguments": extra},
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
