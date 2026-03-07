"""
Standalone async database seeding script.
Run with: python -m scripts.seed
"""

from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure project root is in path
_ROOT = Path(__file__).resolve().parent.parent
import sys

if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session, init_db
from app.core.security import hash_password
from app.models import (
    Challenge,
    ChallengeAttempt,
    Coupon,
    KnowledgeBaseEntry,
    Order,
    OrderItem,
    Payment,
    Product,
    Review,
    User,
    UserProfile,
)
from app.services.challenge_service import CHALLENGE_DEFINITIONS

USERS_DATA = [
    {
        "username": "alice",
        "email": "alice@aigoatshop.com",
        "password": "password123",
        "first_name": "Alice",
        "last_name": "Security",
        "is_staff": False,
        "is_superuser": False,
        "profile": {
            "phone": "+1-555-0123",
            "address": "123 Security Street",
            "city": "Cyber City",
            "state": "CA",
            "zip_code": "90210",
            "country": "US",
            "card_holder": "Alice Security",
            "card_number": "4111111111111111",
            "card_type": "Visa",
            "expiry_month": "12",
            "expiry_year": "2025",
        },
    },
    {
        "username": "bob",
        "email": "bob@aigoatshop.com",
        "password": "password123",
        "first_name": "Bob",
        "last_name": "Hacker",
        "is_staff": False,
        "is_superuser": False,
        "profile": {
            "phone": "+1-555-0456",
            "address": "456 Hacker Avenue",
            "city": "Code Town",
            "state": "NY",
            "zip_code": "10001",
            "country": "US",
            "card_holder": "Bob Hacker",
            "card_number": "5555555555554444",
            "card_type": "Mastercard",
            "expiry_month": "08",
            "expiry_year": "2026",
        },
    },
    {
        "username": "charlie",
        "email": "charlie@aigoatshop.com",
        "password": "password123",
        "first_name": "Charlie",
        "last_name": "Penetration",
        "is_staff": False,
        "is_superuser": False,
        "profile": {
            "phone": "+1-555-0901",
            "address": "789 Penetration Lane",
            "city": "Security Valley",
            "state": "FL",
            "zip_code": "33101",
            "country": "US",
            "card_holder": "Charlie Penetration",
            "card_number": "6011111111111117",
            "card_type": "Discover",
            "expiry_month": "06",
            "expiry_year": "2026",
        },
    },
    {
        "username": "frank",
        "email": "frank@aigoatshop.com",
        "password": "password123",
        "first_name": "Frank",
        "last_name": "Vulnerability",
        "is_staff": False,
        "is_superuser": False,
        "profile": {
            "phone": "+1-555-1234",
            "address": "321 Vulnerability Drive",
            "city": "Hackerville",
            "state": "WA",
            "zip_code": "98101",
            "country": "US",
            "card_holder": "Frank Vulnerability",
            "card_number": "30569309025904",
            "card_type": "Diners Club",
            "expiry_month": "09",
            "expiry_year": "2025",
        },
    },
    {
        "username": "admin",
        "email": "admin@aigoatshop.com",
        "password": "admin123",
        "first_name": "Admin",
        "last_name": "User",
        "is_staff": True,
        "is_superuser": True,
        "profile": {
            "phone": "+1-555-0789",
            "address": "789 Admin Boulevard",
            "city": "System City",
            "state": "TX",
            "zip_code": "75001",
            "country": "US",
            "card_holder": "Admin User",
            "card_number": "378282246310005",
            "card_type": "American Express",
            "expiry_month": "03",
            "expiry_year": "2027",
        },
    },
]

PRODUCTS_DATA = [
    {"name": 'The "Code Break" Hacker Cap', "description": 'Break code, not dress code. Black cap with bold "Code Break" embroidery in red—because your exploits deserve a crown.', "detailed_description": "Premium cotton blend with a structured crown that holds its shape. Bold red embroidery delivers the message: you crack systems for a living. Adjustable strap fits any head. Long coding sessions, security assessments, or that DEF CON stroll—this cap has you covered.", "specifications": {"make": "AI Goat", "model": "RTS-CB-001", "manufacturer": "AI Goat Labs", "country_of_origin": "United States", "item_weight": "0.2 lbs (90g)", "product_dimensions": "12\" x 8\" x 4\" (30cm x 20cm x 10cm)", "material": "100% Cotton Blend", "color": "Black with Red Embroidery", "size": "One Size Fits All (Adjustable)", "care_instructions": "Machine wash cold, air dry", "warranty": "1 Year Limited Warranty"}, "price": 2499, "image": 'The "Code Break" Hacker Cap (Hacker Cap).png', "quantity": 50},
    {"name": 'The "Prompt Injection" Hacker Mug', "description": "Your morning coffee deserves a side of injection. 15oz ceramic mug.", "detailed_description": "Premium ceramic with a smooth, glossy finish.", "specifications": {"make": "AI Goat", "model": "RTS-PI-002", "material": "Premium Ceramic"}, "price": 1699, "image": 'The "Prompt Injection" Hacker Mug.png', "quantity": 75},
    {"name": 'The "Adversarial" Red Team T-Shirt', "description": "Think like an attacker. Dress like you mean it. 100% ring-spun cotton.", "detailed_description": "Pre-shrunk cotton, reinforced seams.", "specifications": {"make": "AI Goat", "model": "RTS-AT-003", "material": "100% Ring-Spun Cotton"}, "price": 2099, "image": 'The "Adversarial" Red Team T-Shirt.png', "quantity": 100},
    {"name": "The AI Phishing Sticker Pack", "description": "10 vinyl stickers that teach while they stick.", "detailed_description": "Weather-resistant vinyl, 10 unique designs.", "specifications": {"make": "AI Goat", "model": "RTS-AP-004", "material": "Premium Vinyl"}, "price": 849, "image": "The AI Phishing Sticker Pack.png", "quantity": 200},
    {"name": 'The "Root Access" Hacker Beanie', "description": "Root access: now for your head. Acrylic blend beanie.", "detailed_description": "Stretchy ribbed construction, soft non-itchy acrylic blend.", "specifications": {"make": "AI Goat", "model": "RTS-RA-005", "material": "80% Acrylic, 20% Wool Blend"}, "price": 1899, "image": 'The "Root Access" Hacker Beanie (Hacker Hat).png', "quantity": 60},
    {"name": 'The "Logic Bomb" Malware Keychain', "description": "Dormant until triggered. Stainless steel keychain.", "detailed_description": "Stainless steel construction, sleek silver finish.", "specifications": {"make": "AI Goat", "model": "RTS-LBM-006", "material": "Stainless Steel"}, "price": 1249, "image": 'The "Logic Bomb" Malware Keychain.png', "quantity": 150},
    {"name": "LLM Red Team Hoodie", "description": "When you break language models for a living. Cotton blend hoodie.", "detailed_description": "80/20 cotton-polyester, premium weight.", "specifications": {"make": "AI Goat", "model": "RTS-LRH-007", "material": "80% Cotton, 20% Polyester"}, "price": 4199, "image": "LLM Red Team Hoodie.png", "quantity": 40},
    {"name": 'The "Model Collapse" Glitch Hoodie', "description": "When AI eats its own output. Glitch-design hoodie.", "detailed_description": "Striking glitch aesthetic captures the chaos of degraded outputs.", "specifications": {"make": "AI Goat", "model": "RTS-MCG-008", "material": "80% Cotton, 20% Polyester"}, "price": 4599, "image": 'The "Model Collapse" Glitch Hoodie.png', "quantity": 35},
    {"name": 'The "Periodic Table of AI Exploits"', "description": "AI exploits, periodic-table style. Every attack vector categorized.", "detailed_description": "24x36 premium matte paper.", "specifications": {"make": "AI Goat", "model": "RTS-PTA-009", "material": "Premium Matte Paper"}, "price": 2999, "image": 'The "Periodic Table of AI Exploits".png', "quantity": 25},
    {"name": "Common LLM Jailbreak Prompts Poster", "description": "Know thy adversary. Curated jailbreak prompts.", "detailed_description": "24x36, clear typography.", "specifications": {"make": "AI Goat", "model": "RTS-CLP-010", "material": "Premium Matte Paper"}, "price": 2499, "image": "Common LLM Jailbreak Prompts Poster.png", "quantity": 30},
    {"name": "Jailbreak and Chill Sticker", "description": 'Patient exploitation, zero stress. "Jailbreak and Chill" vinyl sticker.', "detailed_description": "Weather-resistant vinyl, 3x3.", "specifications": {"make": "AI Goat", "model": "RTS-JCS-011", "material": "Premium Vinyl"}, "price": 449, "image": "Jailbreak and Chill Sticker.png", "quantity": 300},
    {"name": "Jailbreak Pro Laptop Sleeve", "description": "Neoprene sleeve with jailbreak design. Fits 13-15.", "detailed_description": "Reinforced stitching, soft interior lining.", "specifications": {"make": "AI Goat", "model": "RTS-JPL-012", "material": "Neoprene"}, "price": 3299, "image": "Jailbreak Pro Laptop Sleeve.png", "quantity": 45},
    {"name": "AI Exploitation Mind Map Poster", "description": "The full attack surface, visualized.", "detailed_description": "24x36, full-color.", "specifications": {"make": "AI Goat", "model": "RTS-AEM-013", "material": "Premium Matte Paper"}, "price": 3799, "image": "AI Exploitation Mind Map Poster.png", "quantity": 20},
    {"name": "Prompt Manipulator Laptop Sticker", "description": "Craft prompts that extract. Vinyl sticker.", "detailed_description": "3x3 weather-resistant vinyl.", "specifications": {"make": "AI Goat", "model": "RTS-PML-014", "material": "Premium Vinyl"}, "price": 349, "image": "Prompt Manipulator Laptop Sticker.png", "quantity": 400},
    {"name": "Pwn. Prompt. Repeat. Cold Brew Glass", "description": "The cycle that never ends. Borosilicate tumbler.", "detailed_description": "Borosilicate glass, hot or cold.", "specifications": {"make": "AI Goat", "model": "RTS-PPR-015", "material": "Borosilicate Glass"}, "price": 1599, "image": "Pwn. Prompt. Repeat. Cold Brew Glass.png", "quantity": 80},
    {"name": "AI Threat Landscape Poster", "description": "The full board. Threats by type, severity, impact.", "detailed_description": "24x36 strategic overview.", "specifications": {"make": "AI Goat", "model": "RTS-ATL-016", "material": "Premium Matte Paper"}, "price": 4199, "image": "AI Threat Landscape Poster.png", "quantity": 15},
    {"name": "LLM Adversary's Shot Glass", "description": "Toast the adversarial. Crystal shot glass.", "detailed_description": "Premium crystal, hand-wash only.", "specifications": {"make": "AI Goat", "model": "RTS-LAS-016", "material": "Premium Crystal Glass"}, "price": 1099, "image": "LLM Adversary shot Glass.png", "quantity": 120},
    {"name": "AI Hallucination Hunter Tee", "description": "You catch the fabrications others miss.", "detailed_description": "100% ring-spun cotton, pre-shrunk.", "specifications": {"make": "AI Goat", "model": "RTS-AHH-017", "material": "100% Ring-Spun Cotton"}, "price": 2099, "image": "AI Hallucination Hunter Tee.png", "quantity": 80},
    {"name": "Data Poisoning Specialist Tee", "description": "You know how a few bad samples corrupt the whole model.", "detailed_description": "100% ring-spun cotton.", "specifications": {"make": "AI Goat", "model": "RTS-DPS-018", "material": "100% Ring-Spun Cotton"}, "price": 2099, "image": "Data Poisoning Specialist Tee.png", "quantity": 75},
    {"name": "Jailbreak Whisperer T-Shirt", "description": "You talk models out of their constraints.", "detailed_description": "100% ring-spun cotton.", "specifications": {"make": "AI Goat", "model": "RTS-JWT-019", "material": "100% Ring-Spun Cotton"}, "price": 2099, "image": "Jailbreak Whisperer T-Shirt.png", "quantity": 85},
    {"name": "Prompt Injection Survivor T-Shirt", "description": "You've been there. Ring-spun tee for survivors.", "detailed_description": "100% ring-spun cotton.", "specifications": {"make": "AI Goat", "model": "RTS-PIS-020", "material": "100% Ring-Spun Cotton"}, "price": 2099, "image": "Prompt Injection Survivor T-Shirt.png", "quantity": 90},
    {"name": "Alignment Bypass Hoodie", "description": "When models drift from intent.", "detailed_description": "80/20 cotton-polyester, premium weight.", "specifications": {"make": "AI Goat", "model": "RTS-ABH-021", "material": "80% Cotton, 20% Polyester"}, "price": 4999, "image": "Alignment Bypass Hoodie.png", "quantity": 30},
    {"name": "RAG Poison Hoodie", "description": "Taint the retrieval, corrupt the output.", "detailed_description": "80/20 cotton-polyester.", "specifications": {"make": "AI Goat", "model": "RTS-RPH-022", "material": "80% Cotton, 20% Polyester"}, "price": 4999, "image": "RAG Poison Hoodie.png", "quantity": 25},
    {"name": "Unfiltered Output Hoodie", "description": "Raw output, zero filter.", "detailed_description": "80/20 cotton-polyester.", "specifications": {"make": "AI Goat", "model": "RTS-UOH-023", "material": "80% Cotton, 20% Polyester"}, "price": 4999, "image": "Unfiltered Output Hoodie.png", "quantity": 35},
    {"name": "Neural Network Mousepad XL", "description": "Desk-sized precision mousepad with neural network topology print.", "detailed_description": "Oversized 900x400mm mousepad.", "specifications": {"make": "AI Goat", "model": "AG-NNM-024", "material": "Micro-woven Cloth"}, "price": 1799, "image": "Desk-sized mousepad.png", "quantity": 65},
    {"name": "Exploit Dev Notebook", "description": "Hardcover dot-grid notebook with exploit development reference tables.", "detailed_description": "Premium A5 hardcover, 192 pages.", "specifications": {"make": "AI Goat", "model": "AG-EDN-025", "material": "100gsm Acid-Free Paper"}, "price": 1299, "image": "Exploit Dev Notebook.png", "quantity": 100},
]

REVIEW_TEMPLATES = {
    "cap_beanie": [
        (5, "Excellent quality! The material is comfortable and the design is perfect for security professionals."),
        (3, "Decent but the sizing runs small. The design is good but the material could be more comfortable."),
        (5, "Perfect for red team operations! The design is bold and the quality is top-notch."),
        (4, "Good quality with a nice design. The material feels durable and the fit is comfortable."),
    ],
    "tshirt_tee": [
        (5, "Outstanding! The cotton is soft and comfortable, perfect for long coding sessions."),
        (2, "Disappointed. The material feels cheap and the design faded after just one wash."),
        (5, "Perfect for security professionals! The design is bold and the quality is exceptional."),
        (4, "Good quality with a nice fit. The design is subtle but effective."),
    ],
    "hoodie": [
        (5, "Exceptional! The material is incredibly soft and warm, perfect for late-night hacking sessions."),
        (4, "Great with excellent comfort and style. The material is high-quality."),
        (5, "Outstanding for cybersecurity work! The design is bold and the quality is top-tier."),
        (4, "Good quality with a nice design. The material is comfortable and the fit is great."),
    ],
    "default": [
        (5, "Excellent for security professionals! The quality is outstanding and the design is perfect."),
        (3, "Average with decent quality. The design is okay but not exceptional."),
        (5, "Perfect for security enthusiasts! The design is bold and the quality is exceptional."),
        (4, "Good quality with a nice design. The product is well-made and professional."),
    ],
}


def _review_key(name: str) -> str:
    if "Cap" in name or "Beanie" in name:
        return "cap_beanie"
    if "T-Shirt" in name or "Tee" in name:
        return "tshirt_tee"
    if "Hoodie" in name:
        return "hoodie"
    return "default"


USER_SHIPPING = {
    "alice": {"first_name": "Alice", "last_name": "Security", "email": "alice@security.com", "phone": "+1-555-0123", "address": "123 Security St", "city": "Cyber City", "state": "CA", "zip_code": "90210", "country": "US", "card_number": "****1234", "card_type": "Visa"},
    "bob": {"first_name": "Bob", "last_name": "Hacker", "email": "bob@hacker.com", "phone": "+1-555-0456", "address": "456 Hacker Ave", "city": "Code Town", "state": "NY", "zip_code": "10001", "country": "US", "card_number": "****5678", "card_type": "Mastercard"},
    "charlie": {"first_name": "Charlie", "last_name": "RedTeam", "email": "charlie@aigoat.co.in", "phone": "+1-555-0789", "address": "789 Red Team Blvd", "city": "Penetration City", "state": "TX", "zip_code": "75001", "country": "US", "card_number": "****9012", "card_type": "American Express"},
    "frank": {"first_name": "Frank", "last_name": "Demo", "email": "frank@demo.com", "phone": "+1-555-0345", "address": "321 Demo Lane", "city": "Test City", "state": "FL", "zip_code": "33101", "country": "US", "card_number": "****3456", "card_type": "Discover"},
}


async def seed_demo_users(session: AsyncSession) -> dict[str, User]:
    users_map: dict[str, User] = {}
    for ud in USERS_DATA:
        r = await session.execute(select(User).where(User.username == ud["username"]))
        existing = r.scalar_one_or_none()
        if existing:
            existing.email = ud["email"]
            existing.first_name = ud["first_name"]
            existing.last_name = ud["last_name"]
            existing.is_staff = ud["is_staff"]
            existing.is_superuser = ud["is_superuser"]
            existing.password_hash = hash_password(ud["password"])
            user = existing
        else:
            user = User(
                username=ud["username"],
                email=ud["email"],
                password_hash=hash_password(ud["password"]),
                first_name=ud["first_name"],
                last_name=ud["last_name"],
                is_staff=ud["is_staff"],
                is_superuser=ud["is_superuser"],
            )
            session.add(user)
            await session.flush()
        users_map[ud["username"]] = user
        prof_data = {**ud["profile"], "first_name": ud["first_name"], "last_name": ud["last_name"], "email": ud["email"]}
        rp = await session.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        prof = rp.scalar_one_or_none()
        if prof:
            for k, v in prof_data.items():
                setattr(prof, k, v)
        else:
            prof = UserProfile(user_id=user.id, **prof_data)
            session.add(prof)
    await session.commit()
    for u in users_map.values():
        await session.refresh(u)
    return users_map


async def seed_products(session: AsyncSession) -> list[Product]:
    products: list[Product] = []
    for pd in PRODUCTS_DATA:
        r = await session.execute(select(Product).where(Product.name == pd["name"]))
        existing = r.scalar_one_or_none()
        if existing:
            for k, v in pd.items():
                setattr(existing, k, v)
            products.append(existing)
        else:
            p = Product(**pd)
            session.add(p)
            await session.flush()
            products.append(p)
    await session.commit()
    for p in products:
        await session.refresh(p)
    return products


async def seed_reviews(session: AsyncSession, users: list[User], products: list[Product]) -> None:
    demo_users = [u for u in users if u.username in ("alice", "bob", "charlie", "frank")]
    for i, product in enumerate(products):
        templates = REVIEW_TEMPLATES[_review_key(product.name)]
        for j, (rating, comment) in enumerate(templates):
            if j >= len(demo_users):
                break
            user = demo_users[j]
            r = await session.execute(select(Review).where(Review.product_id == product.id, Review.user_id == user.id))
            if r.scalar_one_or_none():
                continue
            rev = Review(product_id=product.id, user_id=user.id, rating=rating, comment=f"{product.name}: {comment}")
            session.add(rev)
    await session.commit()


async def seed_orders(session: AsyncSession, users: list[User], products: list[Product]) -> None:
    demo_users = [u for u in users if u.username in ("alice", "bob", "charlie", "frank")]
    statuses = ["delivered"] * 4 + ["cancelled"] * 1 + ["shipped"] * 1 + ["pending", "processing"]
    for user in demo_users:
        ship = USER_SHIPPING[user.username]
        for _ in range(random.randint(6, 8)):
            num_items = random.randint(1, 3)
            selected = random.sample(products, min(num_items, len(products)))
            items = [(p, random.randint(1, 3), float(p.price)) for p in selected]
            total = sum(qty * price for _, qty, price in items)
            discount = float(random.randint(0, 25)) if random.random() > 0.5 else 0.0
            final = total - discount
            status = random.choice(statuses)
            order = Order(
                user_id=user.id,
                total_amount=total,
                discount_amount=float(discount),
                final_amount=final,
                status=status,
                shipping_first_name=ship["first_name"],
                shipping_last_name=ship["last_name"],
                shipping_email=ship["email"],
                shipping_phone=ship["phone"],
                shipping_address=ship["address"],
                shipping_city=ship["city"],
                shipping_state=ship["state"],
                shipping_zip_code=ship["zip_code"],
                shipping_country=ship["country"],
                custom_order_id=f"ORD-{random.randint(10000, 99999)}",
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90)),
            )
            session.add(order)
            await session.flush()
            for prod, qty, price in items:
                session.add(OrderItem(order_id=order.id, product_id=prod.id, quantity=qty, price=price))
            session.add(Payment(order_id=order.id, card_number=ship["card_number"], card_type=ship["card_type"], amount=final))
    await session.commit()


async def seed_coupon(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    r = await session.execute(select(Coupon).where(Coupon.code == "WELCOME20"))
    if r.scalar_one_or_none():
        return
    session.add(Coupon(
        code="WELCOME20",
        name="Welcome Discount",
        description="Welcome discount for new customers",
        discount_type="percentage",
        discount_value=20,
        minimum_order_amount=50,
        usage_limit=100,
        usage_limit_per_user=1,
        valid_from=now - timedelta(days=30),
        valid_until=now + timedelta(days=365),
        is_active=True,
    ))
    await session.commit()


async def seed_challenges(session: AsyncSession) -> None:
    await session.execute(delete(ChallengeAttempt))
    await session.execute(delete(Challenge))
    await session.commit()
    for defn in CHALLENGE_DEFINITIONS:
        c = Challenge(
            title=defn["title"],
            description=defn["description"],
            difficulty=defn["difficulty"],
            points=defn["points"],
            owasp_ref=defn["owasp_ref"],
            evaluator_key=defn["evaluator_key"],
            hints=defn["hints"],
            target_route=defn.get("target_route"),
        )
        session.add(c)
    await session.commit()


async def seed_knowledge_base(session: AsyncSession, products: list[Product]) -> None:
    existing = await session.execute(select(KnowledgeBaseEntry).limit(1))
    if existing.scalar_one_or_none():
        return

    from app.api.rag import _generate_default_knowledge
    defaults = _generate_default_knowledge(products)
    for gen in defaults:
        entry = KnowledgeBaseEntry(
            product_id=gen["product_id"],
            title=gen["title"],
            content=gen["content"],
            category=gen["category"],
        )
        session.add(entry)
    await session.commit()


async def run_seed() -> None:
    import app.models as _models  # noqa: F401 — register models with Base.metadata
    assert _models
    await init_db()
    async with async_session() as session:
        users_map = await seed_demo_users(session)
        users = list(users_map.values())
        products = await seed_products(session)
        await seed_reviews(session, users, products)
        await seed_orders(session, users, products)
        await seed_coupon(session)
        await seed_challenges(session)
        await seed_knowledge_base(session, products)
    print("Seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(run_seed())
