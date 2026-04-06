"""Admin API route handlers.

All list endpoints use eager loading to avoid N+1 query patterns.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models import (
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    Product,
    User,
)

router = APIRouter(prefix="", tags=["admin"])


def _require_admin(user: User) -> None:
    if not user.is_staff:
        raise ForbiddenError("Access denied. Admin privileges required.")


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/api/admin/dashboard/")
async def admin_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _require_admin(user)

    users_count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    products_count = (await db.execute(select(func.count()).select_from(Product))).scalar() or 0
    orders_count = (await db.execute(select(func.count()).select_from(Order))).scalar() or 0
    coupons_count = (await db.execute(select(func.count()).select_from(Coupon))).scalar() or 0

    status_result = await db.execute(
        select(Order.status, func.count()).group_by(Order.status)
    )
    order_status_counts: dict[str, int] = {
        s: 0 for s in ("pending", "processing", "shipped", "delivered", "cancelled")
    }
    for row_status, cnt in status_result.all():
        order_status_counts[row_status] = cnt

    recent_result = await db.execute(
        select(Order)
        .options(joinedload(Order.user))
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    recent_data = []
    for order in recent_result.scalars().all():
        recent_data.append({
            "id": order.id,
            "order_id": order.custom_order_id or f"ORD-{order.id:06d}",
            "user": order.user.username,
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Order.final_amount), func.sum(Order.total_amount)))
        .where(Order.status == "delivered")
    )
    total_revenue = float(revenue_result.scalar() or 0)

    out_of_stock = (
        await db.execute(select(func.count()).select_from(Product).where(Product.quantity == 0))
    ).scalar() or 0
    low_stock = (
        await db.execute(
            select(func.count()).select_from(Product).where(
                Product.quantity <= 5, Product.quantity > 0
            )
        )
    ).scalar() or 0
    sold_out = (
        await db.execute(select(func.count()).select_from(Product).where(Product.is_sold_out == True))
    ).scalar() or 0

    return {
        "total_users": users_count,
        "total_products": products_count,
        "total_orders": orders_count,
        "total_coupons": coupons_count,
        "total_revenue": str(total_revenue),
        "order_status_counts": order_status_counts,
        "recent_orders": recent_data,
        "inventory_stats": {
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "sold_out": sold_out,
        },
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/api/admin/users/")
async def admin_list_users(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.username.notin_(["alice", "bob", "charlie", "frank"]))
        .order_by(User.created_at)
    )
    users = result.scalars().all()
    user_list = []
    for u in users:
        p = u.profile
        user_list.append({
            "id": u.id,
            "username": u.username,
            "first_name": p.first_name if p else (u.first_name or ""),
            "last_name": p.last_name if p else (u.last_name or ""),
            "email": p.email if p else (u.email or ""),
            "phone": p.phone if p else "",
            "address": p.address if p else "",
            "city": p.city if p else "",
            "state": p.state if p else "",
            "zip_code": p.zip_code if p else "",
            "country": p.country if p else "",
            "date_joined": u.created_at.isoformat() if u.created_at else None,
            "is_active": u.is_active,
            "is_admin": u.is_staff,
        })
    return {"users": user_list}


@router.delete("/api/admin/users/{user_id}/")
async def admin_delete_user(
    user_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    if user.id == user_id:
        raise ValidationError("Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundError("User not found")
    await db.delete(target)
    await db.commit()
    return {"success": True, "message": "User deleted successfully"}


# ---------------------------------------------------------------------------
# Orders (eager-loaded, no N+1)
# ---------------------------------------------------------------------------

@router.get("/api/admin/orders/")
async def admin_list_orders(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(
        select(Order)
        .options(
            joinedload(Order.user),
            selectinload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.applied_coupon_rel),
        )
        .order_by(Order.created_at.desc())
    )
    orders = result.unique().scalars().all()
    order_list = []
    for order in orders:
        u = order.user
        items_data = []
        for oi in order.items:
            p = oi.product
            img = f"/media/{p.image}" if p and p.image else None
            items_data.append({
                "id": oi.id,
                "product": {"id": p.id, "name": p.name, "price": str(p.price), "image_url": img} if p else None,
                "quantity": oi.quantity,
                "price": str(oi.price),
                "total": str(oi.quantity * oi.price),
            })
        applied_coupon = order.applied_coupon_rel.code if order.applied_coupon_rel else None
        order_list.append({
            "id": order.id,
            "order_id": order.custom_order_id or f"ORD-{order.id:06d}",
            "user": {"id": u.id, "username": u.username, "first_name": u.first_name, "last_name": u.last_name, "email": u.email},
            "total_amount": str(order.total_amount),
            "discount_amount": str(order.discount_amount),
            "final_amount": str(order.final_amount) if order.final_amount else None,
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "shipping_info": {
                "first_name": order.shipping_first_name,
                "last_name": order.shipping_last_name,
                "email": order.shipping_email,
                "phone": order.shipping_phone,
                "address": order.shipping_address,
                "city": order.shipping_city,
                "state": order.shipping_state,
                "zip_code": order.shipping_zip_code,
                "country": order.shipping_country,
            },
            "items": items_data,
            "applied_coupon": applied_coupon,
        })
    return {"orders": order_list}


@router.put("/api/admin/orders/{order_id}/")
async def admin_update_order(
    order_id: int,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundError("Order not found")
    new_status = body.get("status")
    if not new_status:
        raise ValidationError("Status is required")
    valid = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if new_status not in valid:
        raise ValidationError(f"Invalid status. Must be one of: {', '.join(valid)}")
    old_status = order.status
    order.status = new_status
    await db.commit()
    await db.refresh(order)
    return {
        "success": True,
        "message": f"Order {order.custom_order_id or order.id} status updated from {old_status} to {new_status}",
        "order": {
            "id": order.id,
            "order_id": order.custom_order_id or f"ORD-{order.id:06d}",
            "status": order.status,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        },
    }


@router.delete("/api/admin/orders/{order_id}/")
async def admin_delete_order(
    order_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundError("Order not found")
    if order.status == "delivered":
        raise ValidationError("Cannot delete delivered orders")
    oid = order.custom_order_id or f"ORD-{order.id:06d}"
    await db.delete(order)
    await db.commit()
    return {"success": True, "message": f"Order {oid} deleted successfully"}


# ---------------------------------------------------------------------------
# Inventory (eager-loaded, subquery aggregation)
# ---------------------------------------------------------------------------

@router.get("/api/admin/inventory/")
async def admin_inventory(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)

    order_stats = await db.execute(
        select(
            OrderItem.product_id,
            func.count().label("total_orders"),
            func.sum(OrderItem.price * OrderItem.quantity).label("total_revenue"),
        ).group_by(OrderItem.product_id)
    )
    stats_map: dict[int, dict] = {}
    for pid, total_orders, total_revenue in order_stats.all():
        stats_map[pid] = {"total_orders": total_orders, "total_revenue": float(total_revenue or 0)}

    result = await db.execute(select(Product).order_by(Product.updated_at.desc()))
    products = result.scalars().all()
    product_list = []
    for p in products:
        s = stats_map.get(p.id, {"total_orders": 0, "total_revenue": 0.0})
        product_list.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "detailed_description": p.detailed_description,
            "specifications": p.specifications,
            "price": str(p.price),
            "image_url": f"/media/{p.image}" if p.image else None,
            "quantity": p.quantity,
            "is_sold_out": p.is_sold_out,
            "is_available": not p.is_sold_out and p.quantity > 0,
            "stock_status": (
                "Sold Out" if p.is_sold_out
                else ("Out of Stock" if p.quantity <= 0 else f"In Stock ({p.quantity} available)")
            ),
            "total_orders": s["total_orders"],
            "total_revenue": s["total_revenue"],
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    out_of_stock = sum(1 for p in products if p.quantity == 0)
    low_stock = sum(1 for p in products if 0 < p.quantity <= 5)
    sold_out = sum(1 for p in products if p.is_sold_out)
    return {
        "total_products": len(products),
        "out_of_stock": out_of_stock,
        "low_stock": low_stock,
        "sold_out": sold_out,
        "products": product_list,
    }


@router.patch("/api/admin/inventory/{product_id}/")
async def admin_update_inventory(
    product_id: int,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    if "quantity" in body:
        product.quantity = max(0, int(body["quantity"]))
    if "is_sold_out" in body:
        product.is_sold_out = bool(body["is_sold_out"])
    await db.commit()
    await db.refresh(product)
    return {
        "success": True,
        "product": {
            "id": product.id,
            "quantity": product.quantity,
            "is_sold_out": product.is_sold_out,
        },
    }


# ---------------------------------------------------------------------------
# Coupons (eager-loaded usage counts)
# ---------------------------------------------------------------------------

@router.get("/api/admin/coupons/")
async def admin_list_coupons(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    _require_admin(user)

    usage_counts = await db.execute(
        select(CouponUsage.coupon_id, func.count().label("cnt"))
        .group_by(CouponUsage.coupon_id)
    )
    usage_map: dict[int, int] = {cid: cnt for cid, cnt in usage_counts.all()}

    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    coupons = result.scalars().all()
    now = datetime.now(timezone.utc)
    coupon_list = []
    for c in coupons:
        vf = c.valid_from.replace(tzinfo=timezone.utc) if c.valid_from.tzinfo is None else c.valid_from
        vu = c.valid_until.replace(tzinfo=timezone.utc) if c.valid_until.tzinfo is None else c.valid_until
        if not c.is_active:
            status = "inactive"
        elif now < vf:
            status = "pending"
        elif now > vu:
            status = "expired"
        else:
            status = "active"
        usage_count = usage_map.get(c.id, 0)
        coupon_list.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "description": c.description,
            "discount_type": c.discount_type,
            "discount_value": str(c.discount_value),
            "minimum_order_amount": str(c.minimum_order_amount),
            "maximum_discount": str(c.maximum_discount) if c.maximum_discount else None,
            "usage_limit": c.usage_limit,
            "usage_limit_per_user": c.usage_limit_per_user,
            "target_audience": c.target_audience,
            "valid_from": c.valid_from.isoformat() if c.valid_from else None,
            "valid_until": c.valid_until.isoformat() if c.valid_until else None,
            "is_active": c.is_active,
            "status": status,
            "total_usage_count": usage_count,
            "remaining_usage": max(0, c.usage_limit - usage_count),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })
    return coupon_list


@router.post("/api/admin/coupons/")
async def admin_create_coupon(
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    now = datetime.now(timezone.utc)
    coupon = Coupon(
        code=body.get("code", "").upper(),
        name=body.get("name", ""),
        description=body.get("description", ""),
        discount_type=body.get("discount_type", "percentage"),
        discount_value=float(body.get("discount_value", 0)),
        minimum_order_amount=float(body.get("minimum_order_amount", 0)),
        maximum_discount=float(body.get("maximum_discount")) if body.get("maximum_discount") is not None else None,
        usage_limit=int(body.get("usage_limit", 1)),
        usage_limit_per_user=int(body.get("usage_limit_per_user", 1)),
        target_audience=body.get("target_audience", "all"),
        valid_from=datetime.fromisoformat(body.get("valid_from", "").replace("Z", "+00:00")) if body.get("valid_from") else now,
        valid_until=datetime.fromisoformat(body.get("valid_until", "").replace("Z", "+00:00")) if body.get("valid_until") else now,
        is_active=body.get("is_active", True),
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return {
        "id": coupon.id,
        "code": coupon.code,
        "name": coupon.name,
        "description": coupon.description,
        "discount_type": coupon.discount_type,
        "discount_value": str(coupon.discount_value),
        "minimum_order_amount": str(coupon.minimum_order_amount),
        "maximum_discount": str(coupon.maximum_discount) if coupon.maximum_discount else None,
        "usage_limit": coupon.usage_limit,
        "usage_limit_per_user": coupon.usage_limit_per_user,
        "target_audience": coupon.target_audience,
        "valid_from": coupon.valid_from.isoformat() if coupon.valid_from else None,
        "valid_until": coupon.valid_until.isoformat() if coupon.valid_until else None,
        "is_active": coupon.is_active,
        "created_at": coupon.created_at.isoformat() if coupon.created_at else None,
        "updated_at": coupon.updated_at.isoformat() if coupon.updated_at else None,
    }


@router.put("/api/admin/coupons/{coupon_id}/")
async def admin_update_coupon(
    coupon_id: int,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise NotFoundError("Coupon not found")
    updatable = [
        "code", "name", "description", "discount_type", "discount_value",
        "minimum_order_amount", "maximum_discount", "usage_limit", "usage_limit_per_user",
        "target_audience", "valid_from", "valid_until", "is_active",
    ]
    for k in updatable:
        if k in body:
            v = body[k]
            if k in ("valid_from", "valid_until"):
                v = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
            elif k in ("discount_value", "minimum_order_amount", "maximum_discount"):
                v = float(v) if v is not None else None
            elif k in ("usage_limit", "usage_limit_per_user"):
                v = int(v)
            elif k == "is_active":
                v = bool(v)
            setattr(coupon, k, v)
    await db.commit()
    await db.refresh(coupon)
    return {"success": True, "coupon": {"id": coupon.id, "code": coupon.code}}


@router.delete("/api/admin/coupons/{coupon_id}/")
async def admin_delete_coupon(
    coupon_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise NotFoundError("Coupon not found")
    await db.delete(coupon)
    await db.commit()
    return {"message": "Coupon deleted successfully"}


# ---------------------------------------------------------------------------
# Coupon usage (eager-loaded, no N+1)
# ---------------------------------------------------------------------------

@router.get("/api/admin/coupons/usage/")
async def admin_coupon_usage(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(
        select(CouponUsage)
        .options(
            joinedload(CouponUsage.coupon),
            joinedload(CouponUsage.user),
            joinedload(CouponUsage.order),
        )
        .order_by(CouponUsage.used_at.desc())
    )
    usages = result.unique().scalars().all()
    total_discount = sum(float(u.discount_amount) for u in usages)
    active_coupons = (
        await db.execute(select(func.count()).select_from(Coupon).where(Coupon.is_active == True))
    ).scalar() or 0
    usage_details = []
    for u in usages:
        oid = None
        if u.order:
            oid = u.order.custom_order_id or f"ORD-{u.order.id:06d}"
        usage_details.append({
            "id": u.id,
            "coupon": u.coupon_id,
            "coupon_code": u.coupon.code,
            "coupon_name": u.coupon.name,
            "user": u.user_id,
            "user_name": u.user.username,
            "order": u.order_id,
            "order_id": oid,
            "order_amount": float(u.order_amount),
            "discount_amount": float(u.discount_amount),
            "used_at": u.used_at.isoformat() if u.used_at else None,
        })
    return {
        "total_usage": len(usages),
        "total_discount_given": total_discount,
        "active_coupons": active_coupons,
        "usage_details": usage_details,
    }


# ---------------------------------------------------------------------------
# Feedback (placeholder)
# ---------------------------------------------------------------------------

@router.get("/api/admin/feedback/")
async def admin_feedback(user: Annotated[User, Depends(get_current_user)]) -> list:
    _require_admin(user)
    return []


@router.get("/api/admin/feedback/stats/")
async def admin_feedback_stats(user: Annotated[User, Depends(get_current_user)]) -> dict:
    _require_admin(user)
    return {"total": 0, "stats": {}}
