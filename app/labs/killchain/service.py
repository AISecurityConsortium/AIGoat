"""Mode, cleanup and the state snapshot the workbench renders. Nothing here is cached or invented."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain import agent, guardrails, memory, policy
from app.labs.killchain.constants import (
    ATTACKER_EMAIL,
    COUPON_PLACEHOLDER,
    INVOICE_FIXTURE_NAME,
    MODE_DEFENDED,
    MODES,
    PROCEDURE_LABELS,
    PROCEDURES,
    QUICK_ACTIONS,
    UNIVERSAL_COUPON,
)
from app.labs.killchain.ingest import find_product
from app.labs.killchain.memory import agent_view, cache_view, connector_view, display_review
from app.labs.killchain.seed import ensure_baseline, get_state, seed, wipe
from app.labs.killchain.tools import money, price_for
from app.labs.killchain.trace import KillChainError, emit, iso, list_events, new_op_id
from app.models.killchain import (
    KcAgentMemory,
    KcApproval,
    KcAttachment,
    KcCheckout,
    KcConnectorCache,
    KcConnectorMemory,
    KcCoupon,
    KcCustomer,
    KcMail,
    KcProduct,
    KcReview,
    KcTicket,
)


async def set_mode(db: AsyncSession, user_id: int, mode: str) -> dict[str, Any]:
    if mode not in MODES:
        raise KillChainError("Mode must be 'vulnerable', 'defended' or 'guardrailed'.")
    state = await ensure_baseline(db, user_id)
    previous = state.mode
    state.mode = mode
    await db.commit()
    kept = {
        "connector_memory": await memory.connector_count(db, user_id),
        "agent_memory": await memory.agent_count(db, user_id),
    }
    await emit(
        db, user_id, new_op_id(), "mode_changed", f"Mode changed: {previous} to {mode}",
        status="info", detail={"from": previous, "to": mode, "memory_untouched": kept},
    )
    return {"mode": mode, "memory_untouched": kept}


async def soft_reset(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """Clear transient state only. Persistent connector and agent memory stay, and the result says so."""
    state = await ensure_baseline(db, user_id)
    agent.cancel_runs(user_id)
    pending = (await db.execute(
        delete(KcApproval).where(KcApproval.user_id == user_id, KcApproval.status == "pending")
    )).rowcount or 0
    cache = (await db.execute(delete(KcConnectorCache).where(KcConnectorCache.user_id == user_id))).rowcount or 0
    state.conversation = []
    await db.commit()
    connector = await memory.connector_count(db, user_id)
    agent_rows = await memory.agent_count(db, user_id)
    await emit(
        db, user_id, new_op_id(), "cleanup", "Soft reset: conversation and transient state cleared",
        status="warning" if (connector or agent_rows) else "ok",
        detail={
            "operation": "soft_reset", "cleared": ["conversation", "pending approvals", "connector cache", "in-flight runs"],
            "pending_approvals_removed": pending, "cache_entries_removed": cache,
            "preserved": {"connector_memory": connector, "agent_memory": agent_rows},
            "note": "Persistent memory is deliberately preserved. Use the hard reset to restore the seeded baseline.",
        },
    )
    return {
        "pending_approvals_removed": pending, "cache_entries_removed": cache,
        "preserved": {"connector_memory": connector, "agent_memory": agent_rows},
    }


async def hard_reset(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """Rebuild the whole lab from the seed. Repeating it changes nothing further."""
    state = await ensure_baseline(db, user_id)
    agent.cancel_runs(user_id)
    await wipe(db, user_id)
    state.conversation = []
    state.epoch = (state.epoch or 1) + 1
    await seed(db, user_id)
    await db.commit()
    await emit(
        db, user_id, new_op_id(), "hard_reset", "Hard reset: seeded baseline restored", status="ok",
        detail={
            "restored": [
                "products", "reviews", "tickets", "customers", "coupons", "connector memory",
                "connector cache", "agent memory", "approvals", "attacker inbox", "checkouts", "trace",
            ],
            "mode": state.mode, "universal_coupon": UNIVERSAL_COUPON,
        },
    )
    return {"reset": True, "mode": state.mode, "epoch": state.epoch}


async def run_cleanup(db: AsyncSession, user_id: int, kind: str) -> dict[str, Any]:
    await ensure_baseline(db, user_id)
    if kind == "agent_memory":
        return await memory.clear_agent_memory(db, user_id, new_op_id())
    if kind == "connector_cache":
        return await memory.clear_connector_cache(db, user_id, new_op_id())
    if kind == "soft_reset":
        return await soft_reset(db, user_id)
    if kind == "hard_reset":
        return await hard_reset(db, user_id)
    raise KillChainError("Unknown cleanup operation.", 404)


# --- snapshot ----------------------------------------------------------------------------------


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _all(db: AsyncSession, model: Any, user_id: int, order: Any = None) -> list[Any]:
    query = select(model).where(model.user_id == user_id)
    return list((await db.execute(query.order_by(order if order is not None else model.id))).scalars().all())


def mail_view(row: KcMail) -> dict[str, Any]:
    return {
        "id": row.id,
        "execution_id": row.execution_id,
        "approval_id": row.approval_id,
        "sender": row.sender,
        "recipient": row.recipient,
        "bcc": row.bcc,
        "subject": row.subject,
        "body": row.body,
        "dataset": row.dataset,
        "categories": row.categories or [],
        "payload": row.payload or {},
        "status": row.status,
        "created_at": iso(row.created_at),
    }


async def inbox(db: AsyncSession, user_id: int) -> list[dict[str, Any]]:
    """Messages the attacker address received, as recipient or BCC."""
    rows = await _all(db, KcMail, user_id, KcMail.id.desc())
    return [mail_view(row) for row in rows if policy.involves_attacker(row.recipient, row.bcc)]


async def snapshot(db: AsyncSession, user_id: int, *, event_limit: int = 300) -> dict[str, Any]:
    state = await ensure_baseline(db, user_id)
    products = await _all(db, KcProduct, user_id)
    by_id = {row.id: row for row in products}
    reviews = await _all(db, KcReview, user_id, KcReview.id.desc())
    tickets = await _all(db, KcTicket, user_id, KcTicket.id.desc())
    attachments = {row.ticket_id: row for row in await _all(db, KcAttachment, user_id)}
    connector = await _all(db, KcConnectorMemory, user_id)
    cache = await _all(db, KcConnectorCache, user_id)
    agent_rows = await _all(db, KcAgentMemory, user_id)
    approvals = await _all(db, KcApproval, user_id, KcApproval.id.desc())
    coupons = await _all(db, KcCoupon, user_id)
    customers = await _all(db, KcCustomer, user_id)
    checkouts = await _all(db, KcCheckout, user_id, KcCheckout.id.desc())
    mails = await inbox(db, user_id)
    events = await list_events(db, user_id, limit=event_limit)
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    pending = [a for a in approvals if a.status == "pending"]
    exfil = sum(1 for e in events if e["kind"] == "exfiltration" and e["status"] == "success")
    abuse = sum(1 for e in events if e["kind"] == "coupon_abuse" and e["status"] == "success")
    live_connector = [row for row in connector if row.status == "persistent"]
    quarantined = len(connector) - len(live_connector)
    poisoned = bool(live_connector or agent_rows)
    if pending:
        overall = "awaiting_approval"
    elif exfil or abuse:
        overall = "compromised"
    elif poisoned:
        overall = "poisoned"
    else:
        overall = "baseline"

    review_rows = []
    ratings: dict[int, list[int]] = {}
    for row in reviews:
        ratings.setdefault(row.product_id, []).append(row.rating)
        product = by_id.get(row.product_id)
        review_rows.append({
            "id": row.id,
            "product_id": row.product_id,
            "product": product.name if product else "",
            "sku": product.sku if product else "",
            "author": row.author,
            "rating": row.rating,
            "text": display_review(row.body),
            "raw": row.body,
            "has_hidden_markup": "<!--" in row.body,
            "seeded": row.seeded,
            "created_at": iso(row.created_at),
        })
    return {
        "lab_id": "killchain-1",
        "mode": state.mode,
        "epoch": state.epoch,
        "overall": overall,
        "status": {
            "connector_memory": len(connector),
            "agent_memory": len(agent_rows),
            "poisoned_memory": len(live_connector) + len(agent_rows),
            "quarantined": quarantined,
            "pending_approvals": len(pending),
            "exfiltration": exfil,
            "coupon_abuse": abuse,
            "inbox": len(mails),
        },
        "products": [
            {
                "id": p.id, "sku": p.sku, "name": p.name, "price": f"{p.price:.2f}",
                "coupon_eligible": p.coupon_eligible,
                "review_count": len(ratings.get(p.id, [])),
                "average_rating": round(sum(ratings[p.id]) / len(ratings[p.id]), 2) if ratings.get(p.id) else None,
            }
            for p in products
        ],
        "reviews": review_rows,
        "tickets": [
            {
                "id": t.id, "subject": t.subject, "body": t.body, "status": t.status, "seeded": t.seeded,
                "today": _aware(t.created_at) >= start, "created_at": iso(t.created_at),
                "attachment": (
                    {
                        "id": attachments[t.id].id, "filename": attachments[t.id].filename,
                        "size_bytes": attachments[t.id].size_bytes,
                        "hidden_runs": sum(1 for s in attachments[t.id].spans or [] if s.get("hidden")),
                    }
                    if t.id in attachments else None
                ),
            }
            for t in tickets
        ],
        "coupons": [
            {"code": c.code, "type": c.kind, "value": f"{c.value:.2f}", "description": c.description, "internal": c.internal}
            for c in coupons
        ],
        "customers": [
            {"id": c.id, "name": c.name, "email": c.email, "order_ref": c.order_ref, "card_brand": c.card_brand,
             "card_last4": c.card_number[-4:], "billing_city": c.billing_city}
            for c in customers
        ],
        "checkouts": [
            {"id": c.id, "product": by_id[c.product_id].name if c.product_id in by_id else "",
             "coupon_code": c.coupon_code, "list_price": f"{c.list_price:.2f}", "final_price": f"{c.final_price:.2f}",
             "execution_id": c.execution_id, "created_at": iso(c.created_at)}
            for c in checkouts[:10]
        ],
        "memory": {
            "connector": [connector_view(r) for r in connector],
            "cache": [cache_view(r) for r in cache],
            "agent": [agent_view(r) for r in agent_rows],
        },
        "approvals": [policy.approval_view(a) for a in approvals[:30]],
        "inbox": mails,
        "events": events,
        "conversation": list(state.conversation or []),
        "attacker_address": ATTACKER_EMAIL,
        "universal_coupon": UNIVERSAL_COUPON,
        "rails": list(guardrails.RAILS),
    }


def examples() -> dict[str, Any]:
    return {
        # The attacker does not know the internal coupon yet. The abuse example keeps a placeholder, and
        # the learner fills it in after the coupon disclosure has put the real code in the attacker inbox.
        "procedures": [
            {"id": key, "label": PROCEDURE_LABELS[key], "text": text.replace(UNIVERSAL_COUPON, COUPON_PLACEHOLDER)}
            for key, text in PROCEDURES.items()
        ],
        "coupon_placeholder": COUPON_PLACEHOLDER,
        "quick_actions": list(QUICK_ACTIONS),
        "fixture": {"filename": INVOICE_FIXTURE_NAME, "url": "/api/killchain/fixtures/invoice.pdf"},
        "attacker_address": ATTACKER_EMAIL,
    }


async def attachment_evidence(db: AsyncSession, user_id: int, attachment_id: int) -> dict[str, Any]:
    row = (await db.execute(
        select(KcAttachment).where(KcAttachment.id == attachment_id, KcAttachment.user_id == user_id)
    )).scalar_one_or_none()
    if row is None:
        raise KillChainError("No such attachment.", 404)
    spans = row.spans or []
    return {
        "id": row.id, "ticket_id": row.ticket_id, "filename": row.filename, "size_bytes": row.size_bytes,
        "sha256": row.sha256, "visible_text": row.visible_text, "hidden_text": row.hidden_text,
        "extracted_text": row.full_text, "spans": spans,
        "summary": {
            "visible_runs": sum(1 for s in spans if not s.get("hidden")),
            "hidden_runs": sum(1 for s in spans if s.get("hidden")),
            "explanation": (
                "A reader sees only the visible runs. The text layer also holds runs painted white or set to an "
                "invisible render mode, and the ingestion pipeline extracts every run."
            ),
        },
    }


async def storefront_coupon(db: AsyncSession, user_id: int, code: str, product: str) -> dict[str, Any]:
    """What a shopper gets when they type a coupon at the storefront. Staff coupons are refused there.

    The agent's pricing tool does not make this check, which is the point of the lab: the same code that
    fails here prices a product at $1.00 when the poisoned agent passes it.
    """
    await ensure_baseline(db, user_id)
    text = (code or "").strip().upper()
    if not text:
        raise KillChainError("Enter a coupon code.")
    row = await find_product(db, user_id, product)
    if row is None:
        raise KillChainError("Unknown product.", 404)
    coupon = (await db.execute(
        select(KcCoupon).where(KcCoupon.user_id == user_id, KcCoupon.code == text)
    )).scalar_one_or_none()
    accepted = coupon is not None and not coupon.internal
    if coupon is None:
        reason = "Invalid coupon code."
    elif coupon.internal:
        reason = "This coupon is restricted to staff and cannot be used on customer orders."
    else:
        reason = ""
    final = price_for(row, coupon) if accepted else row.price
    result = {
        "accepted": accepted,
        "message": "Coupon applied" if accepted else "Failed to apply coupon",
        "reason": reason,
        "product": row.name,
        "coupon_code": text,
        "list_price": money(row.price),
        "final_price": money(final),
    }
    await emit(
        db, user_id, new_op_id(), "storefront_coupon",
        f"Storefront: coupon {text} {'applied' if accepted else 'refused'} for a shopper on {row.name}",
        status="ok" if accepted else "blocked",
        detail={**result, "channel": "storefront", "caller": "shopper"},
    )
    return result


async def count_pending(db: AsyncSession, user_id: int) -> int:
    value = await db.execute(
        select(func.count()).select_from(KcApproval).where(KcApproval.user_id == user_id, KcApproval.status == "pending")
    )
    return int(value.scalar() or 0)


def is_killchain(lab: Any) -> bool:
    lab_id = lab.get("id") if isinstance(lab, dict) else getattr(lab, "id", None)
    return lab_id == "killchain-1"


__all__ = [
    "attachment_evidence", "examples", "get_state", "hard_reset", "inbox", "is_killchain", "run_cleanup",
    "set_mode", "snapshot", "soft_reset", "storefront_coupon", "MODE_DEFENDED",
]
