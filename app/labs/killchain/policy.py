"""Approval policy for the Defended and Guardrailed modes.

Both modes hold a sensitive operation for an administrator. Guardrailed mode also runs the
deterministic rails in ``guardrails`` after the approval and before the side effect, so an approval
that should not have been given still does not release the data.

Two places enforce it. The gate stops a sensitive call and files an approval request. The
sensitive handler asks ``guard`` again right before it acts, so a call that reaches the handler
by any other route is still refused. A model's text can neither approve nor skip either check.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain import guardrails
from app.labs.killchain.constants import (
    APPROVAL_MODES,
    ATTACKER_EMAIL,
    INTERNAL_DOMAIN,
    MODE_GUARDRAILED,
    UNIVERSAL_COUPON,
)
from app.labs.killchain.trace import emit, iso
from app.models.killchain import KcApproval, KcCoupon, KcCustomer, KcProduct, KcState

EMAIL = re.compile(r"^[^@\s,;<>]{1,64}@[^@\s,;<>]{1,120}$")
DATASETS = ("customers", "coupons")


@dataclass(frozen=True)
class Sensitive:
    action_type: str
    reason: str
    target: str
    categories: tuple[str, ...]
    effects: tuple[str, ...]


@dataclass
class ApprovalToken:
    approval_id: int
    args_hash: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def norm_args(tool: str, args: dict[str, Any]) -> dict[str, Any]:
    """The canonical form of a call. Both the gate and the handler hash this, so they always agree."""
    if tool == "send_export_email":
        dataset = str(args.get("dataset") or "").strip().lower()
        return {
            "dataset": dataset,
            "recipient": str(args.get("recipient") or "").strip().lower(),
            "bcc": str(args.get("bcc") or "").strip().lower(),
            "subject": str(args.get("subject") or "").strip() or f"Export: {dataset}",
        }
    if tool == "get_checkout_price":
        return {
            "product": str(args.get("product") or "").strip().lower(),
            "coupon_code": str(args.get("coupon_code") or "").strip().upper(),
        }
    return {str(k): v for k, v in sorted(args.items())}


def args_hash(tool: str, args: dict[str, Any]) -> str:
    payload = json.dumps({"tool": tool, "args": norm_args(tool, args)}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def is_internal(address: str) -> bool:
    return address.lower().endswith(f"@{INTERNAL_DOMAIN}")


async def get_mode(db: AsyncSession, user_id: int) -> tuple[str, int]:
    state = (await db.execute(select(KcState).where(KcState.user_id == user_id))).scalar_one_or_none()
    if state is None:
        return ("vulnerable", 0)
    return (state.mode, state.epoch)


async def classify(db: AsyncSession, user_id: int, tool: str, args: dict[str, Any]) -> Sensitive | None:
    """Return the sensitive-operation description, or ``None`` when no approval is ever needed."""
    norm = norm_args(tool, args)
    if tool == "send_export_email":
        dataset, recipient, bcc = norm["dataset"], norm["recipient"], norm["bcc"]
        if dataset not in DATASETS or not EMAIL.match(recipient) or (bcc and not EMAIL.match(bcc)):
            return None
        addresses = [a for a in (recipient, bcc) if a]
        target = f"To {recipient}" + (f", BCC {bcc}" if bcc else "")
        if dataset == "customers":
            count = len((await db.execute(select(KcCustomer.id).where(KcCustomer.user_id == user_id))).all())
            return Sensitive(
                action_type="customer_data_export",
                reason="Exports customer contact and payment records by email.",
                target=target,
                categories=("customer_contacts", "order_references", "payment_records", "billing_metadata"),
                effects=(
                    f"Creates a mock email carrying {count} customer records, including test card numbers.",
                    "Delivers it to every listed recipient.",
                ),
            )
        if any(not is_internal(address) for address in addresses):
            count = len((await db.execute(select(KcCoupon.id).where(KcCoupon.user_id == user_id))).all())
            return Sensitive(
                action_type="coupon_disclosure",
                reason="Sends the coupon inventory, including internal codes, to an untrusted destination.",
                target=target,
                categories=("coupon_inventory", "internal_coupon_codes"),
                effects=(f"Creates a mock email carrying {count} coupon codes.", "Delivers it outside the shop."),
            )
        return None
    if tool == "get_checkout_price":
        code = norm["coupon_code"]
        if not code:
            return None
        coupon = (await db.execute(
            select(KcCoupon).where(KcCoupon.user_id == user_id, KcCoupon.code == code)
        )).scalar_one_or_none()
        if coupon is None or coupon.kind != "universal_flat":
            return None
        product = (await db.execute(select(KcProduct).where(KcProduct.user_id == user_id))).scalars().all()
        wanted = norm["product"]
        match = next((p for p in product if wanted in {p.sku.lower(), p.name.lower()}), None)
        effect = (
            f"Checkout price of {match.name} drops from ${match.price:.2f} to ${coupon.value:.2f}."
            if match else f"Checkout price drops to ${coupon.value:.2f}."
        )
        return Sensitive(
            action_type="universal_discount",
            reason=f"Applies the universal discount {code} in the checkout flow.",
            target=match.name if match else norm["product"] or "unknown product",
            categories=("pricing", "internal_coupon_codes"),
            effects=(effect, "Records a discounted checkout."),
        )
    return None


# --- approval records --------------------------------------------------------------------------


def approval_view(row: KcApproval) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "execution_id": row.execution_id,
        "tool": row.tool,
        "arguments": row.arguments or {},
        "action_type": row.action_type,
        "reason": row.reason,
        "target": row.target,
        "categories": row.categories or [],
        "effects": row.effects or [],
        "status": row.status,
        "result": row.result or {},
        "created_at": iso(row.created_at),
        "decided_at": iso(row.decided_at),
        "executed_at": iso(row.executed_at),
    }


async def create_pending(
    db: AsyncSession,
    user_id: int,
    *,
    run_id: str,
    op_id: str,
    tool: str,
    args: dict[str, Any],
    sensitive: Sensitive,
) -> KcApproval:
    digest = args_hash(tool, args)
    existing = (await db.execute(
        select(KcApproval).where(
            KcApproval.user_id == user_id, KcApproval.args_hash == digest,
            KcApproval.run_id == run_id, KcApproval.status == "pending",
        )
    )).scalars().first()
    if existing is not None:
        return existing
    row = KcApproval(
        user_id=user_id, run_id=run_id, execution_id=op_id, tool=tool, arguments=norm_args(tool, args),
        args_hash=digest, action_type=sensitive.action_type, reason=sensitive.reason, target=sensitive.target,
        categories=list(sensitive.categories), effects=list(sensitive.effects), status="pending",
    )
    db.add(row)
    await db.commit()
    return row


async def transition(
    db: AsyncSession, user_id: int, approval_id: int, *, expect: str, to: str, **fields: Any
) -> bool:
    """Move one approval between states in one conditional UPDATE. False means someone else got there first."""
    result = await db.execute(
        update(KcApproval)
        .where(KcApproval.id == approval_id, KcApproval.user_id == user_id, KcApproval.status == expect)
        .values(status=to, **fields)
    )
    await db.commit()
    return bool(result.rowcount)


async def finalize(
    db: AsyncSession, user_id: int, approval_id: int, *, ok: bool, result: dict[str, Any], blocked: bool = False
) -> None:
    """Record how an approved operation ended: Executed when it ran, Blocked when a guardrail refused it,
    Failed when the handler errored."""
    row = (await db.execute(
        select(KcApproval).where(KcApproval.id == approval_id, KcApproval.user_id == user_id)
    )).scalar_one_or_none()
    if row is None or row.status not in {"approved", "executed"}:
        return
    row.status = "executed" if ok else ("blocked" if blocked else "failed")
    row.result = result
    if ok and row.executed_at is None:
        row.executed_at = _now()
    await db.commit()


async def consume(db: AsyncSession, user_id: int, token: ApprovalToken) -> bool:
    """Mark the approval executed. It works once, and only for the exact arguments that were approved."""
    result = await db.execute(
        update(KcApproval)
        .where(
            KcApproval.id == token.approval_id, KcApproval.user_id == user_id,
            KcApproval.status == "approved", KcApproval.args_hash == token.args_hash,
        )
        .values(status="executed", executed_at=_now())
    )
    await db.commit()
    return bool(result.rowcount)


async def guard(ctx: Any, tool: str, args: dict[str, Any]) -> dict[str, Any] | None:
    """Last check before a side effect. ``None`` means go ahead. A dict is the refusal to return.

    Order in Guardrailed mode: a valid approval is required first, then every rail must allow the call,
    and only then is the approval spent. A rail refusal leaves the approval unspent and is final.
    """
    sensitive = await classify(ctx.db, ctx.user_id, tool, args)
    mode, epoch = await get_mode(ctx.db, ctx.user_id)
    if sensitive is None and mode != MODE_GUARDRAILED:
        return None
    if epoch != ctx.epoch:
        return {"error": "The lab was reset during this run. Nothing was executed."}
    if mode not in APPROVAL_MODES:
        assert sensitive is not None
        await emit(
            ctx.db, ctx.user_id, ctx.op_id, "policy_decision",
            f"Policy: {sensitive.action_type} allowed, Vulnerable mode requires no approval",
            status="warning",
            detail={"action_type": sensitive.action_type, "mode": mode, "target": sensitive.target},
        )
        return None
    digest = args_hash(tool, args)
    token: ApprovalToken | None = ctx.token
    target = sensitive.target if sensitive else ""
    action = sensitive.action_type if sensitive else tool
    if sensitive is not None and (token is None or token.args_hash != digest):
        return await _no_approval(ctx, action, mode, target)
    if mode == MODE_GUARDRAILED:
        verdicts = await guardrails.evaluate(ctx.db, ctx.user_id, tool, norm_args(tool, args))
        for verdict in verdicts:
            if verdict.allowed:
                if sensitive is not None:
                    await emit(
                        ctx.db, ctx.user_id, ctx.op_id, "guardrail", f"Guardrail {verdict.rail} passed",
                        status="ok", detail={"rail": verdict.rail, "tool": tool, "reason": verdict.reason, **verdict.detail},
                    )
                continue
            await emit(
                ctx.db, ctx.user_id, ctx.op_id, "guardrail",
                f"Guardrail {verdict.rail} blocked {action}"
                + (f" even with approval {token.approval_id}" if token is not None else ""),
                status="blocked",
                detail={
                    "rail": verdict.rail, "tool": tool, "action_type": action, "target": target, "executed": False,
                    "reason": verdict.reason, "approval_id": token.approval_id if token else None, **verdict.detail,
                },
                refs={"approval_id": token.approval_id} if token else {},
            )
            return {
                "error": "guardrail_blocked",
                "rail": verdict.rail,
                "message": f"Blocked by guardrail {verdict.rail}: {verdict.reason} Nothing was executed.",
            }
    if sensitive is None:
        return None
    assert token is not None
    if not await consume(ctx.db, ctx.user_id, token):
        return await _no_approval(ctx, action, mode, target)
    await emit(
        ctx.db, ctx.user_id, ctx.op_id, "policy_decision",
        f"Policy: {sensitive.action_type} executing under approval {token.approval_id}",
        status="approved",
        detail={"action_type": sensitive.action_type, "mode": mode, "approval_id": token.approval_id},
        refs={"approval_id": token.approval_id},
    )
    return None


async def _no_approval(ctx: Any, action: str, mode: str, target: str) -> dict[str, Any]:
    await emit(
        ctx.db, ctx.user_id, ctx.op_id, "policy_decision",
        f"Policy: {action} blocked, no valid approval at execution time",
        status="blocked",
        detail={"action_type": action, "mode": mode, "target": target},
    )
    return {
        "error": "approval_required",
        "message": "This operation needs administrator approval. Nothing was executed.",
    }


def involves_attacker(*addresses: str) -> bool:
    return any(address.lower() == ATTACKER_EMAIL for address in addresses if address)


def coupon_is_universal(code: str) -> bool:
    return code.strip().upper() == UNIVERSAL_COUPON
