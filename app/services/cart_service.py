"""Cart domain service.

Pure business logic and read-only queries for cart operations.
Transaction control (commit/rollback) is handled by the route layer.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import Cart, CartItem, Product
from app.schemas.shop import CartItemOut, CartOut


def image_url(image: str | None) -> str | None:
    if image:
        return f"/media/{image}"
    return None


async def load_cart_with_items(db: AsyncSession, user_id: int) -> Cart | None:
    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items).joinedload(CartItem.product))
        .where(Cart.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def load_cart_by_id(db: AsyncSession, cart_id: int) -> Cart:
    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items).joinedload(CartItem.product))
        .where(Cart.id == cart_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def find_cart_item(
    db: AsyncSession, cart_id: int, product_id: int
) -> CartItem | None:
    result = await db.execute(
        select(CartItem).where(
            CartItem.cart_id == cart_id, CartItem.product_id == product_id
        )
    )
    return result.scalar_one_or_none()


async def find_cart_item_by_id(
    db: AsyncSession, item_id: int, cart_id: int
) -> CartItem | None:
    result = await db.execute(
        select(CartItem)
        .options(joinedload(CartItem.product))
        .where(CartItem.id == item_id, CartItem.cart_id == cart_id)
    )
    return result.scalar_one_or_none()


async def load_product(db: AsyncSession, product_id: int) -> Product | None:
    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one_or_none()


def build_cart_out(cart: Cart) -> CartOut:
    items_out: list[CartItemOut] = []
    total = 0.0
    for item in cart.items:
        total += float(item.product.price) * item.quantity
        items_out.append(
            CartItemOut(
                id=item.id,
                product=item.product_id,
                product_name=item.product.name,
                quantity=item.quantity,
                product_price=float(item.product.price),
                product_image_url=image_url(item.product.image),
            )
        )
    return CartOut(id=cart.id, items=items_out, total=round(total, 2))
