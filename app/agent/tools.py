"""Shop-domain tools for agent.runner. No generic exec, filesystem, or network."""
from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from app.services.tool_registry import Tool, ToolRegistry

SHOP_TOOL_NAMES = (
    "lookup_order",
    "lookup_product",
    "apply_coupon",
    "issue_refund",
    "export_customer_data",
)


def _order_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"order_id": {"type": "integer"}},
        "required": ["order_id"],
        "additionalProperties": False,
    }


def shop_tools(db: AsyncSession, user: User) -> ToolRegistry:
    """Closures over the calling user. Refunds never touch another user's row."""
    registry = ToolRegistry()

    async def lookup_order(order_id: int) -> dict[str, Any]:
        result = await db.execute(
            select(Order).where(
                Order.user_id == user.id,
                or_(Order.id == order_id, Order.custom_order_id == str(order_id)),
            )
        )
        order = result.scalar_one_or_none()
        if order is None:
            return {"error": "order not found", "order_id": order_id}
        return {
            "order_id": order.id,
            "custom_order_id": order.custom_order_id,
            "status": order.status,
            "total": str(order.total_amount),
            "final_amount": str(order.final_amount) if order.final_amount is not None else None,
        }

    async def lookup_product(query: str) -> dict[str, Any]:
        needle = (query or "").strip()
        if not needle:
            return {"products": []}
        result = await db.execute(
            select(Product).where(Product.name.contains(needle)).limit(5)
        )
        rows = result.scalars().all()
        return {
            "products": [
                {"id": p.id, "name": p.name, "price": str(p.price)}
                for p in rows
            ]
        }

    async def apply_coupon(code: str) -> dict[str, Any]:
        # Demo confirmation only — does not mutate carts. Restricted codes are
        # the intentional excessive-agency teaching surface at Level 0.
        raw = (code or "").strip()
        result = await db.execute(select(Coupon).where(Coupon.code == raw))
        coupon = result.scalar_one_or_none()
        return {
            "applied": True,
            "code": raw,
            "known": coupon is not None,
            "note": "coupon marked applied in the agent session",
        }

    async def issue_refund(order_id: int) -> dict[str, Any]:
        result = await db.execute(
            select(Order).where(
                Order.user_id == user.id,
                or_(Order.id == order_id, Order.custom_order_id == str(order_id)),
            )
        )
        order = result.scalar_one_or_none()
        if order is None:
            return {
                "refunded": False,
                "order_id": order_id,
                "error": "order not found",
            }
        order.status = "refunded"
        await db.flush()
        return {
            "refunded": True,
            "order_id": order.id,
            "status": "refunded",
        }

    async def export_customer_data(scope: str = "self") -> dict[str, Any]:
        # Scoped to the calling user on purpose (no platform IDOR).
        return {
            "scope": scope,
            "rows": [{"username": user.username, "email": user.email}],
            "note": "demo export of the calling user only",
        }

    registry.register(Tool(
        name="lookup_order",
        description="Look up one of the current user's orders by numeric id.",
        handler=lookup_order,
        parameter_schema=_order_schema(),
    ))
    registry.register(Tool(
        name="lookup_product",
        description="Search shop products by name fragment.",
        handler=lookup_product,
        parameter_schema={
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="apply_coupon",
        description="Apply a coupon code in this agent session.",
        handler=apply_coupon,
        parameter_schema={
            "type": "object",
            "properties": {"code": {"type": "string"}},
            "required": ["code"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="issue_refund",
        description="Issue a refund for one of the current user's orders.",
        handler=issue_refund,
        requires_approval=True,
        parameter_schema=_order_schema(),
    ))
    registry.register(Tool(
        name="export_customer_data",
        description="Export the calling user's customer record (demo).",
        handler=export_customer_data,
        requires_approval=True,
        parameter_schema={
            "type": "object",
            "properties": {"scope": {"type": "string"}},
            "required": [],
            "additionalProperties": False,
        },
    ))
    return registry
