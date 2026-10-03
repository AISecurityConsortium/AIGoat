from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_DECOY = "aigoat-decoy-mcp-token-not-a-secret"


class McpResultScanControl(DefenseControl):
    id = "mcp.result_scan"
    name = "MCP tool result scan"
    verifies = (
        "decoy tokens in tool results are redacted from model-facing text at Level 2"
    )
    applies_to = (DefenseStage.OUTPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        text = decision.payload or ""
        if _DECOY not in text:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=text.replace(_DECOY, "[redacted]"),
            control_id=self.id,
            reason="redacted decoy token in tool result",
        )
