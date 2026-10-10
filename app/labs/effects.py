"""Real but synthetic lab impact for the agentic security labs.

The MCP child is a sandboxed decoy and cannot touch the database, so the parent
applies the state change a successful attack implies. For the goal-hijack lab
that is a refunded order and a closed ticket; for the tool-misuse lab it is an
unauthorized staff discount applied to an order. Reset restores the original
state. All data is synthetic and local. No money moves and no external call is
made.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Coupon, Order, SupportMessage, SupportTicket

# (user_id, lab_id) -> {
#   "orders": {id: prev_status},
#   "tickets": {id: prev_status},
#   "messages": [id],
#   "discounts": {id: {final_amount, discount_amount, applied_coupon_id}},
# }
_applied: dict[tuple[int, str], dict] = {}


def _record(user_id: int, lab_id: str) -> dict:
    return _applied.setdefault(
        (user_id, lab_id),
        {"orders": {}, "tickets": {}, "messages": [], "discounts": {}},
    )


def _is_empty(record: dict) -> bool:
    return not (
        record["orders"]
        or record["tickets"]
        or record["messages"]
        or record.get("discounts")
    )


async def apply_goal_hijack_impact(
    db: AsyncSession,
    user_id: int,
    lab_id: str,
    *,
    order_id: int | None,
    ticket_id: int | None,
    reply: str,
) -> dict:
    """Refund the order and close the ticket a hijack drove. Returns a summary.

    The previous state of every row touched is recorded so reset can restore it.
    """
    record = _record(user_id, lab_id)
    impact: dict = {}
    if order_id is not None:
        order = (
            await db.execute(select(Order).where(Order.id == order_id))
        ).scalar_one_or_none()
        if order is not None and order.status != "refunded":
            record["orders"].setdefault(order.id, order.status)
            order.status = "refunded"
            impact["order"] = {"id": order.id, "status": "refunded"}
    if ticket_id is not None:
        ticket = (
            await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
        ).scalar_one_or_none()
        if ticket is not None and ticket.status != "closed":
            record["tickets"].setdefault(ticket.id, ticket.status)
            message = SupportMessage(ticket_id=ticket.id, user_id=user_id, body=reply)
            db.add(message)
            await db.flush()
            record["messages"].append(message.id)
            ticket.status = "closed"
            impact["ticket"] = {"id": ticket.id, "status": "closed"}
    if impact:
        await db.commit()
    else:
        # Nothing changed, so drop an empty record we may have created.
        if _is_empty(record):
            _applied.pop((user_id, lab_id), None)
    return impact


async def apply_coupon_impact(
    db: AsyncSession,
    user_id: int,
    lab_id: str,
    *,
    code: str,
    order_ref: int,
) -> dict:
    """Apply the unauthorized discount a tool-misuse call implies. Returns a summary or {}.

    The lab's lookup-only agent was steered into calling ``apply_coupon`` with a
    restricted staff code. The named order is resolved by numeric id or by its
    order code (for example 1003 matches ``ORD-1003``) and the discount is really
    written to that order. When the code matches a seeded coupon its discount is
    used; otherwise the order is fully comped. The previous amounts are recorded
    so reset restores them.
    """
    candidates = {str(order_ref), f"ORD-{order_ref}"}
    order = (
        await db.execute(
            select(Order).where(
                or_(Order.id == order_ref, Order.custom_order_id.in_(candidates))
            )
        )
    ).scalars().first()
    record = _record(user_id, lab_id)
    impact: dict = {}
    already = order is not None and order.id in record.get("discounts", {})
    if order is not None and not already and order.applied_coupon_id is None:
        coupon = (
            await db.execute(select(Coupon).where(Coupon.code == (code or "").strip()))
        ).scalar_one_or_none()
        prior_final = order.final_amount if order.final_amount is not None else order.total_amount
        prior_final = Decimal(str(prior_final))
        if coupon is not None and coupon.discount_type == "percentage":
            discount = (prior_final * Decimal(str(coupon.discount_value))) / Decimal(100)
        elif coupon is not None:
            discount = min(Decimal(str(coupon.discount_value)), prior_final)
        else:
            discount = prior_final
        discount = discount.quantize(Decimal("0.01"))
        new_final = max(prior_final - discount, Decimal(0)).quantize(Decimal("0.01"))
        record["discounts"][order.id] = {
            "final_amount": order.final_amount,
            "discount_amount": order.discount_amount,
            "applied_coupon_id": order.applied_coupon_id,
        }
        order.final_amount = new_final
        order.discount_amount = discount
        order.applied_coupon_id = coupon.id if coupon is not None else None
        impact["order"] = {
            "id": order.id,
            "order_id": order.custom_order_id or f"ORD-{order.id:06d}",
            "coupon": coupon.code if coupon is not None else (code or "").strip(),
            "discount": str(discount),
            "final_amount": str(new_final),
        }
        await db.commit()
    elif _is_empty(record):
        _applied.pop((user_id, lab_id), None)
    return impact


async def restore_lab_effects(db: AsyncSession, user_id: int, lab_id: str) -> dict:
    """Undo a prior hijack impact for this user and lab. Returns what was restored."""
    record = _applied.pop((user_id, lab_id), None)
    if not record:
        return {}
    restored: dict = {"orders": [], "tickets": [], "discounts": []}
    for message_id in record["messages"]:
        message = (
            await db.execute(select(SupportMessage).where(SupportMessage.id == message_id))
        ).scalar_one_or_none()
        if message is not None:
            await db.delete(message)
    for order_id, status in record["orders"].items():
        order = (
            await db.execute(select(Order).where(Order.id == order_id))
        ).scalar_one_or_none()
        if order is not None:
            order.status = status
            restored["orders"].append({"id": order_id, "status": status})
    for ticket_id, status in record["tickets"].items():
        ticket = (
            await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
        ).scalar_one_or_none()
        if ticket is not None:
            ticket.status = status
            restored["tickets"].append({"id": ticket_id, "status": status})
    for order_id, prev in record.get("discounts", {}).items():
        order = (
            await db.execute(select(Order).where(Order.id == order_id))
        ).scalar_one_or_none()
        if order is not None:
            order.final_amount = prev["final_amount"]
            order.discount_amount = prev["discount_amount"]
            order.applied_coupon_id = prev["applied_coupon_id"]
            restored["discounts"].append({"id": order_id})
    await db.commit()
    return restored


def clear_all_effects() -> None:
    """Tests only."""
    _applied.clear()


async def restore_all_effects(db: AsyncSession) -> None:
    """Tests only: undo every recorded impact so the shared DB stays clean."""
    for user_id, lab_id in list(_applied.keys()):
        await restore_lab_effects(db, user_id, lab_id)
