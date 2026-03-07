"""Order domain service.

Pure business logic and read-only queries for order operations.
Transaction control (commit/rollback) is handled by the route layer.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.security import mask_card_number
from app.models import Order, OrderItem, Payment
from app.schemas.shop import (
    OrderItemOut,
    OrderOut,
    PaymentOut,
    ShippingInfo,
)
from app.services.cart_service import image_url


async def list_user_orders(db: AsyncSession, user_id: int) -> list[Order]:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).joinedload(OrderItem.product),
            selectinload(Order.payment),
            joinedload(Order.user),
            joinedload(Order.applied_coupon_rel),
        )
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


def build_order_out(
    order: Order,
    user_name: str,
    items: list[OrderItem],
    payment: Payment | None,
) -> OrderOut:
    shipping_info = ShippingInfo(
        name=f"{order.shipping_first_name} {order.shipping_last_name}".strip(),
        email=order.shipping_email,
        phone=order.shipping_phone,
        address=order.shipping_address,
        city=order.shipping_city,
        state=order.shipping_state,
        zip_code=order.shipping_zip_code,
        country=order.shipping_country,
    )
    order_id = order.custom_order_id or f"ORD-{order.id:06d}"
    items_out: list[OrderItemOut] = []
    for oi in items:
        img = image_url(oi.product.image) if oi.product else None
        items_out.append(
            OrderItemOut(
                id=oi.id,
                product=oi.product_id,
                product_name=oi.product.name,
                quantity=oi.quantity,
                price=float(oi.price),
                product_image_url=img,
            )
        )
    payment_out = None
    if payment:
        payment_out = PaymentOut(
            id=payment.id,
            user_name=user_name,
            card_number=mask_card_number(payment.card_number),
            card_type=payment.card_type,
            amount=float(payment.amount) if payment.amount else None,
            created_at=payment.created_at,
        )
    return OrderOut(
        id=order.id,
        order_id=order_id,
        user_name=user_name,
        created_at=order.created_at,
        total_amount=float(order.total_amount),
        final_amount=float(order.final_amount) if order.final_amount else None,
        discount_amount=float(order.discount_amount),
        applied_coupon=order.applied_coupon_rel.code if order.applied_coupon_rel else None,
        status=order.status,
        items=items_out,
        payment=payment_out,
        shipping_info=shipping_info,
    )
