from __future__ import annotations

from app.defense.control import (
    ControlAction,
    ControlOutcome,
    DefenseControl,
    DefenseDecision,
    DefenseStage,
)

# Coupon codes reserved for staff. A customer-facing shop agent must never apply
# these to a customer order, regardless of which tool it reaches for. In
# production this maps to the coupon's ``target_audience == "staff"`` check done
# server-side; here it is a deterministic code check so the lab is reproducible.
_RESTRICTED_CODES = frozenset({"STAFF100"})
_RESTRICTED_PREFIXES = ("STAFF",)


def _is_restricted(code: str) -> bool:
    norm = (code or "").strip().upper()
    if not norm:
        return False
    return norm in _RESTRICTED_CODES or norm.startswith(_RESTRICTED_PREFIXES)


class ToolCouponPolicyControl(DefenseControl):
    id = "tool.coupon_policy"
    name = "Coupon policy"
    verifies = (
        "apply_coupon calls that name a staff-restricted coupon are denied "
        "before the handler runs. Customer-facing coupon codes are unaffected."
    )
    applies_to = (DefenseStage.TOOL_CALL,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        if str(decision.context.get("tool") or "") != "apply_coupon":
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        args = decision.context.get("arguments") or {}
        code = str(args.get("code") or "")
        if _is_restricted(code):
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=(
                    f"coupon {code.strip()!r} is staff-restricted and cannot be "
                    "applied to a customer order by this agent"
                ),
                rejection_key="coupon_restricted",
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
        )
