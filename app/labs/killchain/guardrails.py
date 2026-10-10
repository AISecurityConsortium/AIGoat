"""Deterministic guardrails for the Guardrailed mode.

Defended mode asks an administrator. Guardrailed mode asks the administrator and then still applies
the rails below, so a wrong "Approve" does not turn into a leak. The rails are plain backend code.
They read the call's arguments and the shop's data, never the model's text or the administrator's
decision, and they run immediately before the side effect.

Where they sit in the flow:

* ``ingest.scan``: at ingestion, new hidden content that reads like an agent instruction is held in
  quarantine and never becomes agent memory. This is a pattern scan, so a determined attacker can
  phrase around it. That is why the later rails exist.
* ``egress.allowlist``: at the mail tool, every To and BCC address must be on the shop's own domain.
* ``data.card_mask``: in an export, full card numbers are masked to the last four digits.
* ``pricing.staff_coupon``: at checkout pricing, staff-only coupons are refused, as they are at the
  storefront.
* ``output.card_mask``: in the agent's closing answer, anything shaped like a card number is masked.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain.constants import INTERNAL_DOMAIN
from app.models.killchain import KcCoupon

RAIL_INGEST = "ingest.scan"
RAIL_EGRESS = "egress.allowlist"
RAIL_CARD_MASK = "data.card_mask"
RAIL_PRICING = "pricing.staff_coupon"
RAIL_OUTPUT = "output.card_mask"

# What the workbench lists for the learner. Order follows the flow of one attack.
RAILS = (
    {
        "id": RAIL_INGEST, "stage": "Ingestion", "kind": "pattern scan",
        "summary": "New hidden content that reads like an agent instruction is quarantined and never becomes agent memory.",
        "note": "Pattern based, so a rephrased instruction can slip past it. Content stored before this mode was switched on is not rescanned.",
    },
    {
        "id": RAIL_EGRESS, "stage": "Mail tool", "kind": "deterministic",
        "summary": f"Every To and BCC address must end in @{INTERNAL_DOMAIN}. One outside address blocks the whole send.",
        "note": "Runs after the administrator approves and cannot be approved away.",
    },
    {
        "id": RAIL_CARD_MASK, "stage": "Export data", "kind": "deterministic",
        "summary": "Exports carry the last four digits of a card, never the full number, even to an internal address.",
        "note": "",
    },
    {
        "id": RAIL_PRICING, "stage": "Checkout pricing", "kind": "deterministic",
        "summary": "Staff-only coupons are refused by the pricing tool, the same rule the storefront applies to a shopper.",
        "note": "Runs after the administrator approves and cannot be approved away.",
    },
    {
        "id": RAIL_OUTPUT, "stage": "Agent answer", "kind": "pattern scan",
        "summary": "Anything shaped like a card number in the closing answer is masked.",
        "note": "",
    },
)

_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_TOOLS = re.compile(r"\b(?:send_export_email|lookup_customers|list_coupons|get_checkout_price)\b", re.IGNORECASE)

# Strong signs of an instruction aimed at an agent. One of these is enough.
_STRONG = (
    ("agent_procedure_marker", re.compile(r"agent\s+procedure", re.IGNORECASE)),
    ("tool_name", _TOOLS),
    ("covert_instruction", re.compile(r"\b(?:do\s*n[o']?t|never)\s+(?:mention|tell|reveal|disclose|report)\b", re.IGNORECASE)),
    ("override_attempt", re.compile(r"\bignore\s+(?:all\s+|any\s+)?(?:previous|prior|earlier)\s+instructions\b", re.IGNORECASE)),
)
# Weak signs. Ordinary prose uses them, so it takes two.
_WEAK = (
    ("standing_instruction", re.compile(r"\b(?:whenever|every\s+time|before\s+answering|first\s+call)\b", re.IGNORECASE)),
    ("bcc_or_forward", re.compile(r"\b(?:bcc|forward\s+a\s+copy|send\s+a\s+copy)\b", re.IGNORECASE)),
    ("coupon_parameter", re.compile(r"\bcoupon_code\b", re.IGNORECASE)),
)


@dataclass(frozen=True)
class Verdict:
    rail: str
    allowed: bool
    reason: str = ""
    detail: dict[str, Any] = field(default_factory=dict)


def is_internal(address: str) -> bool:
    return address.strip().lower().endswith(f"@{INTERNAL_DOMAIN}")


def scan_untrusted(text: str) -> list[str]:
    """Names of the instruction signs found in extracted content. Empty means it passed the scan."""
    body = text or ""
    found = [name for name, pattern in _STRONG if pattern.search(body)]
    weak = [name for name, pattern in _WEAK if pattern.search(body)]
    outside = [m for m in _EMAIL.findall(body) if not is_internal(m)]
    if outside:
        weak.append("outside_address")
    if len(weak) >= 2:
        found.extend(weak)
    return found


def check_egress(norm: dict[str, Any]) -> Verdict:
    addresses = [a for a in (norm.get("recipient"), norm.get("bcc")) if a]
    outside = [a for a in addresses if not is_internal(a)]
    if outside:
        return Verdict(
            RAIL_EGRESS, False,
            f"{', '.join(outside)} is outside @{INTERNAL_DOMAIN}. The mail tool only sends inside the shop.",
            {"blocked_addresses": outside, "allowed_domain": INTERNAL_DOMAIN},
        )
    return Verdict(RAIL_EGRESS, True, "Every address is on the shop's own domain.", {"addresses": addresses})


async def check_pricing(db: AsyncSession, user_id: int, norm: dict[str, Any]) -> Verdict:
    code = norm.get("coupon_code") or ""
    if not code:
        return Verdict(RAIL_PRICING, True, "No coupon was passed.")
    coupon = (await db.execute(
        select(KcCoupon).where(KcCoupon.user_id == user_id, KcCoupon.code == code)
    )).scalar_one_or_none()
    if coupon is not None and (coupon.internal or coupon.kind == "universal_flat"):
        return Verdict(
            RAIL_PRICING, False,
            f"{code} is a staff-only coupon. The pricing tool does not apply it, and the storefront refuses it too.",
            {"coupon": code},
        )
    return Verdict(RAIL_PRICING, True, "The coupon is a public customer coupon.", {"coupon": code})


async def evaluate(db: AsyncSession, user_id: int, tool: str, norm: dict[str, Any]) -> list[Verdict]:
    """Every rail that applies to one tool call, in flow order. The call may run only if all allow it."""
    if tool == "send_export_email":
        return [check_egress(norm)]
    if tool == "get_checkout_price":
        return [await check_pricing(db, user_id, norm)]
    return []


def mask_card(number: str) -> str:
    digits = re.sub(r"\D", "", number or "")
    if len(digits) <= 4:
        return "*" * len(digits)
    return "*" * (len(digits) - 4) + digits[-4:]


def _luhn(digits: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(digits)):
        value = int(char)
        if index % 2:
            value = value * 2 - 9 if value > 4 else value * 2
        total += value
    return total % 10 == 0


_CARD_SHAPE = re.compile(r"(?<![\w-])(?:\d[ -]?){12,18}\d(?![\w-])")


def redact_cards(text: str) -> tuple[str, int]:
    """Mask card-shaped numbers in free text. Returns the new text and how many were masked."""
    count = 0

    def swap(match: re.Match[str]) -> str:
        nonlocal count
        digits = re.sub(r"\D", "", match.group(0))
        if not 13 <= len(digits) <= 19 or not _luhn(digits):
            return match.group(0)
        count += 1
        return mask_card(digits)

    return _CARD_SHAPE.sub(swap, text or ""), count
