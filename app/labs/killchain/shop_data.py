"""Reads the AIGoat shop's own demo data so the lab starts from the real catalog, reviews, customers,
coupons and tickets.

The lab never writes to these tables. ``seed`` copies what it needs into the lab's own ``kc_*`` rows,
which is why a hard reset can wipe the lab without touching the shop. The copy is taken at seed time,
so the baseline follows the shop as it is when the lab is first opened or reset.

Only demo data is read. Cards are the published payment-network test numbers that the shop seed
already stores. The lab shows the last four digits to the agent and, like the shop, keeps the rest
inside the simulated export only.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon
from app.models.order import Order
from app.models.product import Product
from app.models.review import Review
from app.models.support_ticket import SupportTicket
from app.models.user import User, UserProfile

MIN_PRODUCTS = 5
MAX_CUSTOMERS = 10
MAX_TICKETS = 12
MAX_COUPONS = 5
_CLOSED = {"closed", "resolved", "done", "solved"}


@dataclass
class ShopSnapshot:
    products: list[tuple[str, str, str, bool]] = field(default_factory=list)
    reviews: list[tuple[str, str, int, str]] = field(default_factory=list)
    tickets: list[tuple[str, str, str, int]] = field(default_factory=list)
    customers: list[tuple[str, str, str, str, str, str, str]] = field(default_factory=list)
    coupons: list[tuple[str, str, str, str, bool]] = field(default_factory=list)


def sku_for(product_id: int) -> str:
    return f"AIG-{int(product_id):03d}"


async def load_shop(db: AsyncSession) -> ShopSnapshot | None:
    """Return the shop's demo data, or ``None`` when the shop is not seeded (a bare or test database)."""
    products = (await db.execute(select(Product).order_by(Product.id))).scalars().all()
    if len(products) < MIN_PRODUCTS:
        return None

    snap = ShopSnapshot()
    for row in products:
        # The shop stores prices in cents.
        price = (Decimal(row.price) / Decimal(100)).quantize(Decimal("0.01"))
        snap.products.append((sku_for(row.id), row.name[:120], str(price), True))

    by_id = {row.id: sku_for(row.id) for row in products}
    review_rows = (await db.execute(
        select(Review, User.username).join(User, User.id == Review.user_id).order_by(Review.id)
    )).all()
    for review, username in review_rows:
        sku = by_id.get(review.product_id)
        if sku:
            snap.reviews.append((sku, username, int(review.rating), review.comment))

    tickets = (await db.execute(
        select(SupportTicket).order_by(SupportTicket.created_at.desc(), SupportTicket.id.desc()).limit(MAX_TICKETS)
    )).scalars().all()
    for index, ticket in enumerate(tickets):
        status = "resolved" if str(ticket.status).lower() in _CLOSED else "open"
        # The newest three count as today so "today's tickets" has something to report on any date.
        hours = 0 if index < 3 else 30 + (index - 3) * 24
        snap.tickets.append((ticket.subject, ticket.body, status, hours))

    people = (await db.execute(
        select(User, UserProfile)
        .join(UserProfile, UserProfile.user_id == User.id)
        .where(User.is_staff.is_(False))
        .order_by(User.id)
        .limit(MAX_CUSTOMERS)
    )).all()
    for user, profile in people:
        if not (profile.card_number or "").strip():
            continue
        latest = (await db.execute(select(func.max(Order.id)).where(Order.user_id == user.id))).scalar()
        name = f"{profile.first_name} {profile.last_name}".strip() or user.username
        snap.customers.append((
            name, user.email, f"AG-{int(latest):05d}" if latest else "no orders",
            profile.card_type or "card", profile.card_number, profile.city or "", profile.zip_code or "",
        ))
    if not snap.customers:
        return None

    coupons = (await db.execute(
        select(Coupon).where(Coupon.is_active.is_(True), Coupon.target_audience == "all").order_by(Coupon.id).limit(MAX_COUPONS)
    )).scalars().all()
    for coupon in coupons:
        kind = "percent" if str(coupon.discount_type).lower().startswith("percent") else "amount"
        snap.coupons.append((
            coupon.code, kind, str(Decimal(coupon.discount_value).quantize(Decimal("0.01"))),
            coupon.description or coupon.name, False,
        ))
    return snap
