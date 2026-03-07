from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError
from app.defense.nemo_guardrails import get_guardrails_service
from app.defense.pipeline import defense_pipeline
from app.models import KnowledgeBaseEntry, Product, User
from app.rag.service import get_rag_service


def _require_admin(user: User) -> None:
    if not user.is_staff:
        raise ForbiddenError("Access denied. Admin privileges required.")

router = APIRouter(prefix="", tags=["rag"])


class RAGChatRequest(BaseModel):
    query: str | None = None
    message: str | None = None
    use_kb: bool = True
    session_id: str | None = None


class KBEntryCreate(BaseModel):
    product_id: int | None = None
    title: str
    content: str
    category: str = "general"


class KBEntryUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None


def _generate_default_knowledge(products: list[Product]) -> list[dict]:
    """Generate exactly 10 curated knowledge base entries covering
    products, refund policy, reviews, and customer support."""
    entries: list[dict] = []

    apparel = [p for p in products if any(k in p.name for k in ("T-Shirt", "Tee", "Hoodie", "Cap", "Beanie"))]
    drinkware = [p for p in products if any(k in p.name for k in ("Mug", "Glass"))]
    accessories = [p for p in products if any(k in p.name for k in ("Sticker", "Keychain", "Mousepad", "Notebook", "Sleeve"))]
    posters = [p for p in products if "Poster" in p.name]

    def _price_range(items):
        if not items:
            return "N/A"
        prices = [float(p.price) for p in items]
        return f"INR {min(prices):.0f} - INR {max(prices):.0f}"

    def _names(items, limit=5):
        return ", ".join(p.name for p in items[:limit])

    # 1 - Product catalog overview
    entries.append({
        "title": "Product Catalog Overview",
        "content": (
            f"AI Goat Shop carries {len(products)} products across categories: "
            f"apparel ({len(apparel)} items), drinkware ({len(drinkware)} items), "
            f"accessories ({len(accessories)} items), and posters/prints ({len(posters)} items). "
            f"Prices range from INR {min(float(p.price) for p in products):.0f} "
            f"to INR {max(float(p.price) for p in products):.0f}."
        ),
        "category": "product_info",
        "product_id": products[0].id if products else 1,
    })

    # 2 - Apparel collection
    entries.append({
        "title": "Apparel Collection",
        "content": (
            f"Our apparel line includes {len(apparel)} items: {_names(apparel)}. "
            f"Price range: {_price_range(apparel)}. All apparel is made from premium cotton blends, "
            "available in sizes S through XXL, and features screen-printed designs."
        ),
        "category": "product_info",
        "product_id": apparel[0].id if apparel else 1,
    })

    # 3 - Drinkware & accessories
    entries.append({
        "title": "Drinkware and Accessories",
        "content": (
            f"Drinkware: {_names(drinkware)} ({_price_range(drinkware)}). "
            f"Accessories: {_names(accessories)} ({_price_range(accessories)}). "
            "All items are made from durable materials suitable for daily use."
        ),
        "category": "product_info",
        "product_id": drinkware[0].id if drinkware else 1,
    })

    # 4 - Posters & prints
    entries.append({
        "title": "Posters and Prints",
        "content": (
            f"Our poster collection includes {len(posters)} items: {_names(posters)}. "
            f"Price range: {_price_range(posters)}. Printed on premium matte paper, "
            "available in standard frame sizes."
        ),
        "category": "product_info",
        "product_id": posters[0].id if posters else 1,
    })

    # 5 - Sizing and materials
    entries.append({
        "title": "Sizing and Materials Guide",
        "content": (
            "T-Shirts and Tees: 100% ring-spun cotton, pre-shrunk, available in S/M/L/XL/XXL. "
            "Hoodies: 80/20 cotton-poly blend, unisex fit, sizes S through XXL. "
            "Caps and Beanies: one-size-fits-most with adjustable straps or stretch knit. "
            "Mugs: 11oz ceramic, dishwasher safe. Stickers: vinyl, waterproof."
        ),
        "category": "product_info",
        "product_id": apparel[0].id if apparel else 1,
    })

    # 6 - Refund policy
    entries.append({
        "title": "Refund and Return Policy",
        "content": (
            "We offer a 30-day return policy for unused items in original packaging. "
            "Refunds are processed within 5-7 business days after we receive the returned item. "
            "Customized or personalized items cannot be returned. Shipping costs for returns are "
            "the responsibility of the buyer unless the item is defective. To initiate a return, "
            "contact support@aigoatshop.com with your order ID."
        ),
        "category": "refund_policy",
        "product_id": products[0].id if products else 1,
    })

    # 7 - Shipping information
    entries.append({
        "title": "Shipping Information",
        "content": (
            "Standard shipping takes 5-7 business days within India. Express shipping (2-3 days) "
            "is available at an additional cost. International shipping is available to select countries "
            "and takes 10-15 business days. Free shipping on orders above INR 2500. "
            "Tracking information is sent via email once the order is dispatched."
        ),
        "category": "support",
        "product_id": products[0].id if products else 1,
    })

    # 8 - Reviews and ratings
    entries.append({
        "title": "Customer Reviews and Ratings",
        "content": (
            "Customers can leave reviews and ratings (1-5 stars) on any product they have purchased. "
            "Reviews are visible on each product page. Our top-rated products consistently receive "
            "4+ star ratings. We encourage honest feedback to help other shoppers make informed decisions. "
            "Review moderation is in place to filter spam and inappropriate content."
        ),
        "category": "reviews",
        "product_id": products[0].id if products else 1,
    })

    # 9 - Customer support
    entries.append({
        "title": "Customer Support",
        "content": (
            "Our support team is available Monday through Friday, 9 AM to 6 PM IST. "
            "Contact us at support@aigoatshop.com or use the in-app chat assistant. "
            "For order-related queries, please have your order ID ready. "
            "We aim to respond to all inquiries within 24 hours."
        ),
        "category": "support",
        "product_id": products[0].id if products else 1,
    })

    # 10 - Coupons and promotions
    entries.append({
        "title": "Coupons and Promotions",
        "content": (
            "AI Goat Shop regularly offers promotional discounts. Use coupon codes at checkout "
            "to receive percentage or flat discounts. Coupons have minimum order requirements and "
            "expiry dates. Check the Coupons page for currently active offers. "
            "New users may receive a welcome discount on their first order."
        ),
        "category": "support",
        "product_id": products[0].id if products else 1,
    })

    return entries


@router.post("/api/rag-chat/")
async def rag_chat(
    body: RAGChatRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    query_text = body.query or body.message
    if not query_text:
        raise HTTPException(status_code=422, detail="Either 'query' or 'message' field is required")

    level = user.defense_level

    if level >= 1:
        pipeline_result = await defense_pipeline.process_input(
            query_text, level, user_id=user.id
        )
        if not pipeline_result.allowed:
            return {
                "response": pipeline_result.message,
                "reply": pipeline_result.message,
                "context_used": [],
                "suggestions": [],
                "use_kb": body.use_kb,
                "injection_detected": True,
            }
        query_text = pipeline_result.message

    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_result = await nemo.check_input(query_text)
            if not nemo_result.allowed:
                return {
                    "response": nemo_result.message,
                    "reply": nemo_result.message,
                    "context_used": [],
                    "suggestions": [],
                    "use_kb": body.use_kb,
                    "injection_detected": True,
                }

    service = get_rag_service()
    result = await service.process_query(query_text, user, use_kb=body.use_kb)

    reply = result.get("reply", "")
    if level >= 1:
        reply = await defense_pipeline.moderate_output(reply, level)
    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_out = await nemo.check_output(reply)
            if not nemo_out.allowed:
                reply = nemo_out.message

    return {
        "response": reply,
        "reply": reply,
        "context_used": result.get("contexts", []),
        "suggestions": [],
        "use_kb": result.get("use_kb", body.use_kb),
        "injection_detected": result.get("injection_detected", False),
    }


@router.get("/api/rag-chat-history/")
async def rag_chat_history(
    user: Annotated[User, Depends(get_current_user)],
) -> list:
    return []


@router.get("/api/knowledge-base/")
async def list_kb_entries(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(
        select(KnowledgeBaseEntry)
        .order_by(KnowledgeBaseEntry.product_id, KnowledgeBaseEntry.id)
    )
    entries = result.scalars().all()
    docs = [
        {
            "id": e.id,
            "product_id": e.product_id,
            "title": e.title,
            "content": e.content,
            "category": e.category,
            "created_at": e.created_at.isoformat() if hasattr(e, "created_at") and e.created_at else None,
        }
        for e in entries
    ]
    unique_products = len({e.product_id for e in entries})
    unique_categories = len({e.category for e in entries})
    category_breakdown = {}
    for e in entries:
        category_breakdown[e.category] = category_breakdown.get(e.category, 0) + 1
    return {
        "documents": docs,
        "statistics": {
            "total_documents": len(docs),
            "products_with_knowledge": unique_products,
            "categories": unique_categories,
            "category_breakdown": category_breakdown,
        },
    }


@router.post("/api/knowledge-base/")
async def add_kb_entry(
    body: KBEntryCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if body.product_id is not None:
        prod = await db.execute(select(Product).where(Product.id == body.product_id))
        if not prod.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Product not found")
    entry = KnowledgeBaseEntry(
        product_id=body.product_id,
        title=body.title,
        content=body.content,
        category=body.category,
        is_user_injected=True,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "product_id": entry.product_id, "title": entry.title}


@router.put("/api/knowledge-base/{entry_id:int}/")
async def update_kb_entry(
    entry_id: int,
    body: KBEntryUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(select(KnowledgeBaseEntry).where(KnowledgeBaseEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if body.title is not None:
        entry.title = body.title
    if body.content is not None:
        entry.content = body.content
    if body.category is not None:
        entry.category = body.category
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "updated": True}


@router.delete("/api/knowledge-base/{entry_id:int}/")
async def delete_kb_entry(
    entry_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_admin(user)
    result = await db.execute(select(KnowledgeBaseEntry).where(KnowledgeBaseEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": True, "id": entry_id}


@router.patch("/api/knowledge-base/")
async def sync_kb(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(select(KnowledgeBaseEntry).order_by(KnowledgeBaseEntry.id))
    entries = list(result.scalars().all())
    service = get_rag_service()
    await service._retrieval.sync_async(entries)
    return {"synced": len(entries), "synced_count": len(entries)}


@router.put("/api/knowledge-base/")
async def regenerate_kb(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    await db.execute(delete(KnowledgeBaseEntry))
    await db.commit()
    products_result = await db.execute(select(Product).order_by(Product.id))
    products = list(products_result.scalars().all())
    defaults = _generate_default_knowledge(products)
    for gen in defaults:
        entry = KnowledgeBaseEntry(
            product_id=gen["product_id"],
            title=gen["title"],
            content=gen["content"],
            category=gen["category"],
        )
        db.add(entry)
    await db.commit()
    result = await db.execute(select(KnowledgeBaseEntry).order_by(KnowledgeBaseEntry.id))
    entries = list(result.scalars().all())
    service = get_rag_service()
    await service._retrieval.sync_async(entries)
    return {"regenerated": True, "entries": len(defaults), "synced": len(entries)}


@router.get("/api/rag-stats/")
async def rag_stats(
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    service = get_rag_service()
    return service.get_stats()
