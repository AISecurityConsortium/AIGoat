from __future__ import annotations

import re

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage

_DECOY = "aigoat-decoy-mcp-token-not-a-secret"
_BILLING = re.compile(r"sk-shop-billing-[a-f0-9]+")


def text_has_exposed_secret(text: str) -> bool:
    return _DECOY in text or _BILLING.search(text) is not None


def redact_exposed_secrets(text: str) -> str:
    return _BILLING.sub("[redacted]", text.replace(_DECOY, "[redacted]"))


class McpResultScanControl(DefenseControl):
    id = "mcp.result_scan"
    name = "MCP tool result scan"
    verifies = (
        "decoy tokens in tool results are redacted from model-facing text at Level 2"
    )
    applies_to = (DefenseStage.OUTPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        text = decision.payload or ""
        if not text_has_exposed_secret(text):
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        return ControlOutcome(
            action=ControlAction.TRANSFORM,
            payload=redact_exposed_secrets(text),
            control_id=self.id,
            reason="redacted credential in tool result",
        )
