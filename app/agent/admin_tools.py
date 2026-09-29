"""Privileged tools for the admin workspace. Not caller-scoped.

These exist so Level 0 can show a confused deputy: the admin's assistant
reads every customer's tickets and can refund or export someone else.
They are only registered for staff users inside an admin lab. Alice's
shop agent keeps using shop_tools.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.order import Order
from app.models.review import Review
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.services.tool_registry import Tool, ToolRegistry

ADMIN_TOOL_NAMES = (
    "list_support_tickets",
    "read_review",
    "lookup_any_order",
    "issue_refund_any",
    "export_customer_data_any",
)


def is_admin_lab(lab_id: str) -> bool:
    """Admin labs are the ones whose id starts with ``admin`` or is listed here."""
    lid = (lab_id or "").strip()
    if lid.startswith("admin"):
        return True
    return lid in {
        "mcp04-1",
        "mcp06-1",
        "mcp08-1",
        "mcp10-1",
        "asi01-1",
        "asi03-1",
        "asi05-1",
        "asi07-1",
        "asi08-1",
        "asi10-1",
    }


def admin_tools(db: AsyncSession, user: User, lab_id: str = "", level: int = 0) -> ToolRegistry:
    registry = ToolRegistry()
    if not getattr(user, "is_staff", False) or not is_admin_lab(lab_id):
        return registry

    async def list_support_tickets() -> dict[str, Any]:
        result = await db.execute(
            select(SupportTicket).options(joinedload(SupportTicket.user)).order_by(SupportTicket.id.desc()).limit(20)
        )
        return {
            "tickets": [
                {
                    "id": row.id,
                    "username": row.user.username if row.user else "",
                    "subject": row.subject,
                    "body": row.body,
                    "status": row.status,
                }
                for row in result.scalars().all()
            ]
        }

    async def read_review(product_id: int) -> dict[str, Any]:
        result = await db.execute(
            select(Review).options(joinedload(Review.user)).where(Review.product_id == product_id).limit(20)
        )
        return {
            "reviews": [
                {
                    "id": row.id,
                    "username": row.user.username if row.user else "",
                    "rating": row.rating,
                    "comment": row.comment,
                }
                for row in result.scalars().all()
            ]
        }

    async def lookup_any_order(order_id: int) -> dict[str, Any]:
        result = await db.execute(
            select(Order).where(or_(Order.id == order_id, Order.custom_order_id == str(order_id)))
        )
        order = result.scalar_one_or_none()
        if order is None:
            return {"error": "order not found", "order_id": order_id}
        return {
            "order_id": order.id,
            "user_id": order.user_id,
            "status": order.status,
            "total": str(order.total_amount),
        }

    async def issue_refund_any(order_id: int) -> dict[str, Any]:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if order is None:
            return {"refunded": False, "error": "order not found", "order_id": order_id}
        order.status = "refunded"
        await db.commit()
        return {"refunded": True, "order_id": order.id, "user_id": order.user_id}

    async def export_customer_data_any(username: str) -> dict[str, Any]:
        result = await db.execute(
            select(User).options(joinedload(User.profile)).where(User.username == (username or "").strip())
        )
        target = result.scalar_one_or_none()
        if target is None:
            return {"error": "customer not found", "username": username}
        profile = target.profile
        return {
            "username": target.username,
            "email": target.email,
            "phone": getattr(profile, "phone", "") if profile else "",
            "address": getattr(profile, "address", "") if profile else "",
        }

    registry.register(Tool(
        name="list_support_tickets",
        description="List open support tickets from every customer.",
        handler=list_support_tickets,
        parameter_schema={"type": "object", "properties": {}, "additionalProperties": False},
    ))
    registry.register(Tool(
        name="read_review",
        description="Read product reviews, including text planted by customers.",
        handler=read_review,
        parameter_schema={
            "type": "object",
            "properties": {"product_id": {"type": "integer"}},
            "required": ["product_id"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="lookup_any_order",
        description="Look up any customer's order by id.",
        handler=lookup_any_order,
        parameter_schema={
            "type": "object",
            "properties": {"order_id": {"type": "integer"}},
            "required": ["order_id"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="issue_refund_any",
        description="Refund any customer's order. Not limited to the caller.",
        handler=issue_refund_any,
        requires_approval=True,
        parameter_schema={
            "type": "object",
            "properties": {"order_id": {"type": "integer"}},
            "required": ["order_id"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="export_customer_data_any",
        description="Export another customer's profile. Not limited to the caller.",
        handler=export_customer_data_any,
        requires_approval=True,
        parameter_schema={
            "type": "object",
            "properties": {"username": {"type": "string"}},
            "required": ["username"],
            "additionalProperties": False,
        },
    ))
    async def accept_handoff(payload: str, signature: str = "") -> dict[str, Any]:
        signed = bool((signature or "").strip())
        return {
            "accepted": True,
            "signed": signed,
            "payload": payload,
            "note": "unsigned handoff trusted" if not signed else "signed handoff accepted",
        }

    async def fan_out(targets: str) -> dict[str, Any]:
        names = [part.strip() for part in (targets or "").split(",") if part.strip()]
        if level >= 2 and len(names) > 2:
            return {"stopped": True, "ran": names[:2], "reason": "circuit breaker open"}
        return {"stopped": False, "ran": names, "cascade": True}

    async def run_shell(command: str) -> dict[str, Any]:
        return {"refused": True, "command": command, "reason": "this lab has no OS command sink"}

    registry.register(Tool(
        name="accept_handoff",
        description="Accept a handoff from another agent. A signature is optional in this lab.",
        handler=accept_handoff,
        parameter_schema={
            "type": "object",
            "properties": {
                "payload": {"type": "string"},
                "signature": {"type": "string"},
            },
            "required": ["payload"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="fan_out",
        description="Send one instruction to a comma-separated list of downstream agents.",
        handler=fan_out,
        parameter_schema={
            "type": "object",
            "properties": {"targets": {"type": "string"}},
            "required": ["targets"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="run_shell",
        description="Ask the fake executor to run a shell command. It always refuses.",
        handler=run_shell,
        parameter_schema={
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"],
            "additionalProperties": False,
        },
    ))
    return registry
