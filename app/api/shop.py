"""Shop API route handlers.

Thin wrappers that delegate business logic to domain services
and handle transaction control (add/commit/delete).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError, ValidationError
from app.models import (
    Cart,
    CartItem,
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    Payment,
    Product,
    Review,
    User,
)
from app.schemas.shop import (
    AddToCartRequest,
    ApplyCouponRequest,
    CartOut,
    CheckoutRequest,
    CouponOut,
    ProductOut,
    ReviewCreateRequest,
    ReviewOut,
    UpdateCartItemRequest,
)
from app.services import cart_service, coupon_service, order_service

router = APIRouter(prefix="", tags=["shop"])


def _product_stock_status(product: Product) -> str:
    if product.is_sold_out:
        return "Sold Out"
    if product.quantity <= 0:
        return "Out of Stock"
    if product.quantity <= 5:
        return f"Low Stock ({product.quantity} left)"
    return f"In Stock ({product.quantity} available)"


def _build_product_out(product: Product, reviews: list, avg: float, count: int, review_outs: list[ReviewOut]) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        description=product.description,
        detailed_description=product.detailed_description,
        specifications=product.specifications or {},
        price=float(product.price),
        image=product.image,
        image_url=cart_service.image_url(product.image),
        average_rating=round(avg, 2),
        review_count=count,
        reviews=review_outs,
        quantity=product.quantity,
        is_sold_out=product.is_sold_out,
        is_available=not product.is_sold_out and product.quantity > 0,
        stock_status=_product_stock_status(product),
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@router.get("/api/products/", response_model=list[ProductOut])
async def list_products(db: Annotated[AsyncSession, Depends(get_db)]) -> list[ProductOut]:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.reviews).selectinload(Review.user))
        .order_by(Product.id)
    )
    out: list[ProductOut] = []
    for p in result.scalars().all():
        reviews = p.reviews
        sorted_revs = sorted(reviews, key=lambda r: r.created_at, reverse=True)[:5]
        avg = sum(r.rating for r in reviews) / len(reviews) if reviews else 0.0
        review_outs = [
            ReviewOut(id=r.id, product=r.product_id, rating=r.rating, comment=r.comment, user_name=r.user.username, created_at=r.created_at)
            for r in sorted_revs
        ]
        out.append(_build_product_out(p, reviews, avg, len(reviews), review_outs))
    return out


@router.get("/api/products/{product_id}/", response_model=ProductOut)
async def get_product(product_id: int, db: Annotated[AsyncSession, Depends(get_db)]) -> ProductOut:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.reviews).selectinload(Review.user))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    reviews = product.reviews
    sorted_revs = sorted(reviews, key=lambda r: r.created_at, reverse=True)[:5]
    avg = sum(r.rating for r in reviews) / len(reviews) if reviews else 0.0
    review_outs = [
        ReviewOut(id=r.id, product=r.product_id, rating=r.rating, comment=r.comment, user_name=r.user.username, created_at=r.created_at)
        for r in sorted_revs
    ]
    return _build_product_out(product, reviews, avg, len(reviews), review_outs)


# ---------------------------------------------------------------------------
# Cart
# ---------------------------------------------------------------------------

@router.get("/api/cart/", response_model=CartOut)
async def get_cart(user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> CartOut:
    cart = await cart_service.load_cart_with_items(db, user.id)
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
        cart = await cart_service.load_cart_by_id(db, cart.id)
    return cart_service.build_cart_out(cart)


@router.post("/api/cart/", response_model=CartOut)
async def add_to_cart(body: AddToCartRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> CartOut:
    product = await cart_service.load_product(db, body.product_id)
    if not product:
        raise NotFoundError("Product not found")
    cart = await cart_service.load_cart_with_items(db, user.id)
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    item = await cart_service.find_cart_item(db, cart.id, body.product_id)
    if item:
        item.quantity += body.quantity
    else:
        item = CartItem(cart_id=cart.id, product_id=body.product_id, quantity=body.quantity)
        db.add(item)
    await db.commit()
    cart = await cart_service.load_cart_by_id(db, cart.id)
    return cart_service.build_cart_out(cart)


@router.patch("/api/cart/items/{item_id}/", response_model=CartOut)
async def update_cart_item(item_id: int, body: UpdateCartItemRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> CartOut:
    cart = await cart_service.load_cart_with_items(db, user.id)
    if not cart:
        raise NotFoundError("Cart not found")
    item = await cart_service.find_cart_item_by_id(db, item_id, cart.id)
    if not item:
        raise NotFoundError("Cart item not found")
    if body.quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = body.quantity
    await db.commit()
    cart = await cart_service.load_cart_by_id(db, cart.id)
    return cart_service.build_cart_out(cart)


@router.delete("/api/cart/items/{item_id}/", response_model=CartOut)
async def remove_cart_item(item_id: int, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> CartOut:
    cart = await cart_service.load_cart_with_items(db, user.id)
    if not cart:
        raise NotFoundError("Cart not found")
    item = await cart_service.find_cart_item_by_id(db, item_id, cart.id)
    if not item:
        raise NotFoundError("Cart item not found")
    await db.delete(item)
    await db.commit()
    cart = await cart_service.load_cart_by_id(db, cart.id)
    return cart_service.build_cart_out(cart)


# ---------------------------------------------------------------------------
# Orders / Checkout
# ---------------------------------------------------------------------------

@router.get("/api/orders/", response_model=list)
async def list_orders(user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> list:
    orders = await order_service.list_user_orders(db, user.id)
    return [order_service.build_order_out(o, o.user.username, o.items, o.payment) for o in orders]


@router.post("/api/checkout/")
async def checkout(body: CheckoutRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    cart = await cart_service.load_cart_with_items(db, user.id)
    if not cart or not cart.items:
        raise ValidationError("Cart is empty")
    total_amount = sum(float(item.product.price) * item.quantity for item in cart.items)
    shipping = body.shipping_info or {}
    payment_info = body.payment_info or {}

    discount_amount = 0.0
    final_amount = total_amount
    applied_coupon = None
    if body.coupon_code:
        result = await db.execute(select(Coupon).where(Coupon.code == body.coupon_code.upper()))
        coupon = result.scalar_one_or_none()
        if not coupon:
            raise ValidationError("Invalid coupon code")
        can_use, msg = await coupon_service.can_use_coupon(db, coupon, user, total_amount)
        if not can_use:
            raise ValidationError(msg)
        discount_amount = coupon_service.calculate_discount(coupon, total_amount)
        final_amount = total_amount - discount_amount
        applied_coupon = coupon

    custom_order_id = body.order_id or f"ORD-{uuid.uuid4().hex[:8].upper()}"
    order = Order(
        user_id=user.id, total_amount=total_amount,
        applied_coupon_id=applied_coupon.id if applied_coupon else None,
        discount_amount=discount_amount, final_amount=final_amount, status="pending",
        custom_order_id=custom_order_id,
        shipping_first_name=shipping.get("firstName", shipping.get("name", "")),
        shipping_last_name=shipping.get("lastName", ""),
        shipping_email=shipping.get("email", ""),
        shipping_phone=shipping.get("phone", ""),
        shipping_address=shipping.get("address", ""),
        shipping_city=shipping.get("city", ""),
        shipping_state=shipping.get("state", ""),
        shipping_zip_code=shipping.get("zipCode", shipping.get("zip_code", "")),
        shipping_country=shipping.get("country", "US"),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    card_num = payment_info.get("cardNumber", "4111111111111111")
    card_type = payment_info.get("cardType", "Visa")
    if isinstance(card_num, str):
        card_num = card_num.replace(" ", "")
    db.add(Payment(order_id=order.id, card_number=card_num, card_type=card_type, amount=final_amount))
    if applied_coupon:
        db.add(CouponUsage(coupon_id=applied_coupon.id, user_id=user.id, order_id=order.id, order_amount=total_amount, discount_amount=discount_amount))
    for item in cart.items:
        db.add(OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity, price=float(item.product.price)))
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    await db.commit()

    return {
        "success": True, "order_id": custom_order_id, "order_number": order.id,
        "total": str(final_amount),
        "discount": str(discount_amount) if discount_amount > 0 else "0.00",
        "applied_coupon": applied_coupon.code if applied_coupon else None,
        "shipping_info": body.shipping_info,
        "payment_info": {"card_type": card_type, "last_four": str(card_num)[-4:] if card_num else "****"},
    }


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

@router.post("/api/reviews/", response_model=ReviewOut)
async def create_review(body: ReviewCreateRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> ReviewOut:
    result = await db.execute(select(Product).where(Product.id == body.product))
    if not result.scalar_one_or_none():
        raise NotFoundError("Product not found")
    existing = await db.execute(select(Review).where(Review.product_id == body.product, Review.user_id == user.id))
    if existing.scalar_one_or_none():
        raise ValidationError("You have already reviewed this product")
    review = Review(product_id=body.product, user_id=user.id, rating=body.rating, comment=body.comment)
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return ReviewOut(id=review.id, product=review.product_id, rating=review.rating, comment=review.comment, user_name=user.username, created_at=review.created_at)


@router.get("/api/reviews/{product_id}/", response_model=list[ReviewOut])
async def list_reviews(product_id: int, db: Annotated[AsyncSession, Depends(get_db)]) -> list[ReviewOut]:
    result = await db.execute(
        select(Review).options(joinedload(Review.user)).where(Review.product_id == product_id).order_by(Review.created_at.desc())
    )
    return [
        ReviewOut(id=r.id, product=r.product_id, rating=r.rating, comment=r.comment, user_name=r.user.username, created_at=r.created_at)
        for r in result.scalars().all()
    ]


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------

@router.get("/api/coupons/", response_model=list[CouponOut])
async def list_coupons(user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> list[CouponOut]:
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Coupon).where(Coupon.is_active == True).order_by(Coupon.created_at.desc()))
    out: list[CouponOut] = []
    for c in result.scalars().all():
        vf = c.valid_from.replace(tzinfo=timezone.utc) if c.valid_from.tzinfo is None else c.valid_from
        vu = c.valid_until.replace(tzinfo=timezone.utc) if c.valid_until.tzinfo is None else c.valid_until
        if now < vf or now > vu:
            continue
        if user.username != "admin" and c.target_audience == "admin":
            continue
        if user.username not in ("admin", "frank") and c.target_audience == "staff":
            continue
        can_use, _ = await coupon_service.can_use_coupon(db, c, user, float("inf"))
        if not can_use:
            continue
        out.append(await coupon_service.build_coupon_out(db, c))
    return out


@router.post("/api/coupons/apply/")
async def apply_coupon(body: ApplyCouponRequest, user: Annotated[User, Depends(get_current_user)], db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    result = await db.execute(select(Coupon).where(Coupon.code == body.coupon_code.upper()))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise ValidationError("Invalid coupon code")
    cart = await cart_service.load_cart_with_items(db, user.id)
    cart_total = 0.0
    if cart and cart.items:
        cart_total = sum(float(i.product.price) * i.quantity for i in cart.items)
    can_use, msg = await coupon_service.can_use_coupon(db, coupon, user, cart_total)
    if not can_use:
        raise ValidationError(msg)
    discount_amount = coupon_service.calculate_discount(coupon, cart_total)
    final_amount = cart_total - discount_amount
    coupon_out = await coupon_service.build_coupon_out(db, coupon)
    return {
        "coupon": coupon_out.model_dump(),
        "cart_total": cart_total,
        "discount_amount": discount_amount,
        "final_amount": final_amount,
        "message": "Coupon applied successfully",
    }


# ---------------------------------------------------------------------------
# Tips
# ---------------------------------------------------------------------------

@router.post("/api/tips/", summary="Submit a product tip",
    description="Submit a text tip and/or file attachment for a product. "
    "Expects multipart/form-data with fields: product_id (int, required), "
    "tip (str, optional text), tip_file (file, optional attachment).")
async def submit_tip(
    user: Annotated[User, Depends(get_current_user)],
    product_id: int = Form(..., description="ID of the product this tip is for"),
    tip: str = Form("", description="Tip text content"),
    tip_file: UploadFile | None = File(None, description="Optional file attachment"),
) -> dict:
    if not tip.strip() and tip_file is None:
        raise ValidationError("Provide either tip text or a file attachment")
    return {"success": True, "message": "Tip submitted successfully! It will be used to enhance our product knowledge base.", "product_id": product_id}
