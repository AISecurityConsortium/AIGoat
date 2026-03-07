"""Coupon domain service.

Pure business logic and read-only queries for coupon operations.
Transaction control (commit/rollback) is handled by the route layer.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Coupon, CouponUsage, User
from app.schemas.shop import CouponOut


def coupon_status(coupon: Coupon) -> str:
    now = datetime.now(timezone.utc)
    if not coupon.is_active:
        return "inactive"
    vf = coupon.valid_from
    if vf.tzinfo is None:
        vf = vf.replace(tzinfo=timezone.utc)
    if now < vf:
        return "pending"
    vu = coupon.valid_until
    if vu.tzinfo is None:
        vu = vu.replace(tzinfo=timezone.utc)
    if now > vu:
        return "expired"
    return "active"


def calculate_discount(coupon: Coupon, order_amount: float) -> float:
    if coupon.discount_type == "percentage":
        discount = (order_amount * coupon.discount_value) / 100
        if coupon.maximum_discount is not None:
            discount = min(discount, coupon.maximum_discount)
    else:
        discount = min(float(coupon.discount_value), order_amount)
    return round(discount, 2)


async def get_usage_count(db: AsyncSession, coupon_id: int) -> int:
    result = await db.execute(
        select(func.count()).select_from(CouponUsage).where(CouponUsage.coupon_id == coupon_id)
    )
    return result.scalar() or 0


async def get_user_usage_count(db: AsyncSession, coupon_id: int, user_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(CouponUsage)
        .where(CouponUsage.coupon_id == coupon_id, CouponUsage.user_id == user_id)
    )
    return result.scalar() or 0


async def can_use_coupon(
    db: AsyncSession, coupon: Coupon, user: User, order_amount: float
) -> tuple[bool, str]:
    now = datetime.now(timezone.utc)
    vf = coupon.valid_from
    vu = coupon.valid_until
    if vf.tzinfo is None:
        vf = vf.replace(tzinfo=timezone.utc)
    if vu.tzinfo is None:
        vu = vu.replace(tzinfo=timezone.utc)
    if not coupon.is_active or now < vf or now > vu:
        return False, "Coupon is not active or has expired"
    if order_amount < coupon.minimum_order_amount:
        return False, f"Minimum order amount of {coupon.minimum_order_amount} required"
    total_usage = await get_usage_count(db, coupon.id)
    if total_usage >= coupon.usage_limit:
        return False, "Coupon usage limit has been reached"
    user_usage = await get_user_usage_count(db, coupon.id, user.id)
    if user_usage >= coupon.usage_limit_per_user:
        return False, "You have already used this coupon the maximum number of times"
    return True, "Coupon can be used"


async def build_coupon_out(db: AsyncSession, coupon: Coupon) -> CouponOut:
    total_usage = await get_usage_count(db, coupon.id)
    return CouponOut(
        id=coupon.id,
        code=coupon.code,
        name=coupon.name,
        description=coupon.description,
        discount_type=coupon.discount_type,
        discount_value=float(coupon.discount_value),
        minimum_order_amount=float(coupon.minimum_order_amount),
        maximum_discount=float(coupon.maximum_discount) if coupon.maximum_discount else None,
        usage_limit=coupon.usage_limit,
        usage_limit_per_user=coupon.usage_limit_per_user,
        target_audience=coupon.target_audience,
        valid_from=coupon.valid_from,
        valid_until=coupon.valid_until,
        is_active=coupon.is_active,
        status=coupon_status(coupon),
        total_usage_count=total_usage,
        remaining_usage=max(0, coupon.usage_limit - total_usage),
        created_at=coupon.created_at,
        updated_at=coupon.updated_at,
    )
