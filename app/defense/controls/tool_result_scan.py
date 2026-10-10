"""Redact untrusted instructions in a tool result before they re-enter the model."""
from __future__ import annotations

import re

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.nemo_fallback import check_sensitive
from app.defense.nemo_guardrails import get_guardrails_service
from app.rag.injection_detector import detect_injection

_NEEDLES = (
    "ignore previous",
    "ignore all previous",
    "disregard your",
    "invent a discount code",
    "standing policy",
    "pre-approved",
    "new instructions",
    "system prompt",
)
_NEEDLE = re.compile("|".join(re.escape(item) for item in _NEEDLES), re.I)
_REDACTED = (
    '{"redacted": true, "control_id": "tool_result.scan", '
    '"reason": "untrusted instruction removed from tool output"}'
)


def _local_hit(text: str) -> str | None:
    hit, reason = detect_injection(text or "")
    if hit:
        return reason or "injection"
    match = _NEEDLE.search(text or "")
    if match:
        return f"tool output matched {match.group(0)!r}"
    return None


class ToolResultScanControl(DefenseControl):
    id = "tool_result.scan"
    name = "Tool result scan"
    verifies = (
        "tool results that carry instruction-override or prompt-leak text are "
        "redacted before they are appended to the model context; NeMo checks the "
        "result when installed, otherwise the local patterns do"
    )
    applies_to = (DefenseStage.TOOL_RESULT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        nemo = get_guardrails_service()
        engine = "nemo" if nemo.available else "fallback"
        reason = _local_hit(decision.payload)
        if reason is None and nemo.available:
            result = await nemo.check_output(decision.payload)
            if not result.allowed:
                reason = result.blocked_reason or "nemo_output"
        elif reason is None:
            allowed, _message, fallback_reason = check_sensitive(decision.payload)
            if not allowed:
                reason = fallback_reason
        metadata = {"engine": engine, "nemo_available": nemo.available}
        if reason:
            return ControlOutcome(
                action=ControlAction.TRANSFORM,
                payload=_REDACTED,
                control_id=self.id,
                reason=reason,
                metadata=metadata,
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata=metadata,
        )
