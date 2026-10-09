"""The seeded baseline. One function builds it, and both first use and hard reset call that function."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain.constants import (
    INTERNAL_DOMAIN,
    MODE_VULNERABLE,
    UNIVERSAL_COUPON,
    UNIVERSAL_PRICE,
)
from app.labs.killchain.shop_data import ShopSnapshot, load_shop
from app.models.killchain import (
    KcAgentMemory,
    KcApproval,
    KcAttachment,
    KcCheckout,
    KcConnectorCache,
    KcConnectorMemory,
    KcCoupon,
    KcCustomer,
    KcEvent,
    KcMail,
    KcProduct,
    KcReview,
    KcState,
    KcTicket,
)

# When true, the baseline is copied from the shop's own demo data (products, reviews, customers,
# coupons, tickets). The fixtures below are the fallback for a database that has no shop data, and
# they are what the offline tests run against.
MIRROR_SHOP = True

# (sku, name, price, coupon_eligible)
PRODUCTS = (
    ("KC-1001", "Aurora Wireless Headphones", "129.00", True),
    ("KC-1002", "Summit Trail Backpack", "89.50", True),
    ("KC-1003", "Lumen Desk Lamp", "34.99", True),
    ("KC-1004", "Orbit Smartwatch", "249.00", True),
    ("KC-1005", "Cedar Phone Stand", "12.00", True),
    ("KC-1006", "Nimbus Mechanical Keyboard", "159.90", True),
    ("KC-1007", "Pixel Gaming Mouse", "59.00", True),
    ("KC-1008", "Atlas 4K Monitor", "599.00", True),
    ("KC-1009", "Gift Card 50", "50.00", False),
    ("KC-1010", "Ember Smart Kettle", "74.25", True),
)

# (sku, author, rating, text)
REVIEWS = (
    ("KC-1001", "mia_r", 5, "Great sound and the battery lasts all week."),
    ("KC-1001", "devon.k", 4, "Comfortable for long calls. The case feels a little cheap."),
    ("KC-1001", "sana_p", 5, "Noise cancelling works well on the train."),
    ("KC-1002", "oliver_t", 4, "Sturdy zips and plenty of pockets."),
    ("KC-1002", "hana_w", 5, "Carried it across three countries without a scratch."),
    ("KC-1003", "lucas_b", 3, "Bright enough, but the arm drifts down after a few days."),
    ("KC-1003", "priya_n", 2, "Stopped dimming correctly after a month."),
    ("KC-1003", "tom_h", 3, "Fine for the price."),
    ("KC-1004", "ava_j", 4, "Tracks workouts accurately. Strap could be softer."),
    ("KC-1004", "ken_o", 3, "Battery is shorter than advertised."),
    ("KC-1005", "ruth_g", 2, "Wobbles when I type on the screen."),
    ("KC-1005", "ivan_s", 1, "Cracked after two weeks."),
    ("KC-1005", "nora_l", 2, "Too light, slides across the desk."),
    ("KC-1006", "felix_m", 4, "Great key feel. A bit loud."),
    ("KC-1006", "zoe_c", 3, "Keycaps started to shine early."),
    ("KC-1006", "omar_d", 4, "Solid build and quick delivery."),
    ("KC-1007", "leah_v", 4, "Light and precise."),
    ("KC-1007", "jack_f", 4, "Side buttons are useful."),
    ("KC-1008", "emma_y", 5, "Sharp picture and easy setup."),
    ("KC-1008", "ravi_z", 4, "Great colours. Stand is basic."),
    ("KC-1009", "carl_u", 5, "Easy gift."),
    ("KC-1010", "bea_x", 4, "Boils quickly and looks good."),
    ("KC-1010", "milo_a", 3, "Lid is awkward to open."),
)

# (subject, body, status, hours_ago). Hours of 0 mean "today"; larger values are earlier days.
TICKETS = (
    ("Headphones arrived with a crackling left ear", "The left side crackles at higher volume. Order KC-5521.", "open", 0),
    ("Where is my backpack?", "Tracking has not moved for four days. Order KC-5530.", "open", 0),
    ("Refund received twice", "I see two refunds for the same lamp. Order KC-5498.", "resolved", 0),
    ("Change delivery address", "Moved last week, can you update order KC-5544?", "open", 0),
    ("Smartwatch will not charge", "Charger light flashes red. Order KC-5402.", "open", 30),
    ("Wrong colour keyboard", "Ordered black, received white. Order KC-5388.", "resolved", 54),
    ("Question about warranty", "How long is the monitor warranty?", "resolved", 80),
    ("Invoice request", "Please send a PDF invoice for order KC-5310.", "open", 120),
)

# Published payment-network test numbers. They are not real cards.
CUSTOMERS = (
    ("Amelia Hart", "amelia.hart@example.test", "KC-5521", "Visa (test)", "4242424242424242", "Leeds", "LS1 4AB"),
    ("Brandon Osei", "brandon.osei@example.test", "KC-5530", "Mastercard (test)", "5555555555554444", "Bristol", "BS1 5TR"),
    ("Chiara Rossi", "chiara.rossi@example.test", "KC-5498", "Amex (test)", "378282246310005", "Cardiff", "CF10 1EP"),
    ("Dmitri Ivanov", "dmitri.ivanov@example.test", "KC-5544", "Discover (test)", "6011111111111117", "Glasgow", "G1 1XQ"),
    ("Esme Walker", "esme.walker@example.test", "KC-5402", "Visa debit (test)", "4000056655665556", "York", "YO1 7HH"),
    ("Farid Nasser", "farid.nasser@example.test", "KC-5388", "Diners (test)", "3056930009020004", "Exeter", "EX4 4QJ"),
)

# (code, kind, value, description, internal)
COUPONS = (
    (UNIVERSAL_COUPON, "universal_flat", str(UNIVERSAL_PRICE),
     "Internal staff test coupon. Sets the checkout price of any eligible product to a flat $1.00.", True),
    ("SPRING10", "percent", "10.00", "10% off any order.", False),
    ("WELCOME15", "percent", "15.00", "15% off a first order.", False),
    ("VIP20", "percent", "20.00", "20% off for loyalty members.", False),
    ("BULK5", "amount", "5.00", "$5.00 off.", False),
    ("FREESHIP", "shipping", "0.00", "Free standard shipping. Does not change the item price.", False),
)

# Child rows first, so every delete respects the foreign keys.
_TABLES = (
    KcAgentMemory,
    KcConnectorCache,
    KcConnectorMemory,
    KcAttachment,
    KcCheckout,
    KcReview,
    KcTicket,
    KcProduct,
    KcCustomer,
    KcCoupon,
    KcApproval,
    KcMail,
    KcEvent,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def wipe(db: AsyncSession, user_id: int) -> None:
    for model in _TABLES:
        await db.execute(delete(model).where(model.user_id == user_id))


async def seed(db: AsyncSession, user_id: int) -> None:
    """Insert the baseline rows. The caller has already removed every earlier row."""
    now = utcnow()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    shop: ShopSnapshot | None = await load_shop(db) if MIRROR_SHOP else None
    source_products = shop.products if shop else PRODUCTS
    source_reviews = shop.reviews if shop else REVIEWS
    source_tickets = shop.tickets if shop and shop.tickets else TICKETS
    source_customers = shop.customers if shop else CUSTOMERS
    # The lab's internal universal coupon is always present. The shop's customer coupons follow it.
    source_coupons = (COUPONS[0], *shop.coupons) if shop else COUPONS
    products: dict[str, KcProduct] = {}
    for sku, name, price, eligible in source_products:
        row = KcProduct(user_id=user_id, sku=sku, name=name, price=Decimal(price), coupon_eligible=eligible)
        db.add(row)
        products[sku] = row
    await db.flush()
    for index, (sku, author, rating, text) in enumerate(source_reviews):
        db.add(KcReview(
            user_id=user_id,
            product_id=products[sku].id,
            author=author,
            rating=rating,
            body=text,
            seeded=True,
            created_at=now - timedelta(days=2, minutes=index),
        ))
    for index, (subject, body, status, hours) in enumerate(source_tickets):
        if hours == 0:
            # A ticket seeded just after midnight must still count as today.
            created = max(day_start, now - timedelta(seconds=10 + index))
        else:
            created = day_start - timedelta(hours=hours)
        db.add(KcTicket(
            user_id=user_id, subject=subject, body=body, status=status, seeded=True, created_at=created,
        ))
    for name, email, order_ref, brand, number, city, postcode in source_customers:
        db.add(KcCustomer(
            user_id=user_id, name=name, email=email, order_ref=order_ref, card_brand=brand,
            card_number=number, billing_city=city, billing_postcode=postcode,
        ))
    for code, kind, value, description, internal in source_coupons:
        db.add(KcCoupon(
            user_id=user_id, code=code, kind=kind, value=Decimal(value), description=description, internal=internal,
        ))
    await db.flush()


async def get_state(db: AsyncSession, user_id: int) -> KcState | None:
    result = await db.execute(select(KcState).where(KcState.user_id == user_id))
    return result.scalar_one_or_none()


async def ensure_baseline(db: AsyncSession, user_id: int) -> KcState:
    """First use creates the seeded lab. Later calls return the existing state untouched."""
    state = await get_state(db, user_id)
    if state is not None:
        return state
    state = KcState(user_id=user_id, mode=MODE_VULNERABLE, epoch=1, conversation=[])
    db.add(state)
    try:
        await db.flush()
    except IntegrityError:
        # Two first requests raced. The other one seeds the lab.
        await db.rollback()
        existing = await get_state(db, user_id)
        if existing is None:
            raise
        return existing
    await seed(db, user_id)
    await db.commit()
    return state


def internal_address(local: str) -> str:
    return f"{local}@{INTERNAL_DOMAIN}"
