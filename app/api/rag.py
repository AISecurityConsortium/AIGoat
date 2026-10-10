from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.dependencies import require_admin as _require_admin
from app.models import KnowledgeBaseEntry, Product, User
from app.rag.service import get_rag_service
from app.schemas.rag import RagTraceIn
from app.surfaces import ensure_registered
from app.surfaces.base import SurfaceRequest
from app.surfaces.registry import get_surface

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
    trust_tier: str | None = None
    owner_id: int | None = None
    version: int = 1
    is_latest: bool = True
    valid_until: str | None = None


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
        return f"USD {min(prices):.0f} - USD {max(prices):.0f}"

    def _names(items, limit=5):
        return ", ".join(p.name for p in items[:limit])

    # 1 - Product catalog overview
    entries.append({
        "title": "Product Catalog Overview",
        "content": (
            f"AI Goat Shop carries {len(products)} products across categories: "
            f"apparel ({len(apparel)} items), drinkware ({len(drinkware)} items), "
            f"accessories ({len(accessories)} items), and posters/prints ({len(posters)} items). "
            f"Prices range from USD {min(float(p.price) for p in products):.0f} "
            f"to USD {max(float(p.price) for p in products):.0f}."
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
            "and takes 10-15 business days. Free shipping on orders above USD 2500. "
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


def _parse_valid_until(value: str | None):
    if not value:
        return None
    from datetime import datetime

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _entry_api(entry: KnowledgeBaseEntry) -> dict:
    indexed = None
    if isinstance(entry.metadata_json, dict):
        indexed = entry.metadata_json.get("indexed_at")
    return {
        "id": entry.id,
        "product_id": entry.product_id,
        "title": entry.title,
        "content": entry.content,
        "category": entry.category,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "is_user_injected": bool(entry.is_user_injected),
        "trust_tier": entry.trust_tier or "user",
        "owner_id": entry.owner_id,
        "version": int(entry.version or 1),
        "is_latest": bool(entry.is_latest),
        "valid_until": entry.valid_until.isoformat() if entry.valid_until else None,
        "content_hash": entry.content_hash,
        "chunk_count": int(entry.chunk_index or 0),
        "indexed_at": indexed,
        "embedding_id": entry.embedding_id,
    }


def _candidate_api(cand: dict) -> dict:
    return {
        "chunk_id": cand.get("chunk_id"),
        "entry_id": cand.get("entry_id"),
        "title": cand.get("title") or "",
        "content": cand.get("content") or "",
        "dense_score": cand.get("dense_score"),
        "bm25_score": cand.get("bm25_score"),
        "rrf_score": cand.get("rrf_score"),
        "rerank_score": cand.get("rerank_score"),
        "is_user_injected": bool(cand.get("is_user_injected")),
        "trust_tier": cand.get("trust_tier") or "user",
        "included_in_context": bool(cand.get("included_in_context", True)),
        "truncated_by_budget": bool(cand.get("truncated_by_budget")),
        "excluded_by_control": cand.get("excluded_by_control"),
    }


@router.post("/api/rag-chat/", include_in_schema=False)
async def rag_chat(
    body: RAGChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    query_text = body.query or body.message
    if not query_text:
        raise HTTPException(status_code=422, detail="Either 'query' or 'message' field is required")

    ensure_registered()
    executed = await get_surface("rag.kb").execute(
        SurfaceRequest(
            user=user,
            db=db,
            input={
                "message": query_text,
                "use_kb": body.use_kb,
            },
        )
    )
    result = executed.result
    reply = result.get("reply") or result.get("response") or ""
    return {
        "response": reply,
        "reply": reply,
        "context_used": result.get("context_used") or [],
        "suggestions": [],
        "use_kb": result.get("use_kb", body.use_kb),
        "injection_detected": result.get("injection_detected", False),
        "citations": result.get("citations") or [],
    }


@router.get("/api/rag-chat-history/", include_in_schema=False)
async def rag_chat_history(
    user: Annotated[User, Depends(get_current_user)],
) -> list:
    return []


@router.get("/api/knowledge-base/")
async def list_kb_entries(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """List all Knowledge Base entries with statistics (total count, categories, breakdown)."""
    result = await db.execute(
        select(KnowledgeBaseEntry)
        .order_by(KnowledgeBaseEntry.product_id, KnowledgeBaseEntry.id)
    )
    entries = result.scalars().all()
    docs = [_entry_api(e) for e in entries]
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
    """Add a new Knowledge Base entry. User-injected entries are intentionally allowed for RAG attack labs."""
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
        trust_tier=body.trust_tier or "user",
        owner_id=body.owner_id if body.owner_id is not None else user.id,
        version=body.version,
        is_latest=body.is_latest,
        valid_until=_parse_valid_until(body.valid_until),
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
    """Update an existing Knowledge Base entry by ID."""
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
    """Delete a Knowledge Base entry by ID. Requires admin privileges."""
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
    rebuild: bool = Query(False),
) -> dict:
    """Sync all Knowledge Base entries into the ChromaDB vector store for RAG retrieval."""
    result = await db.execute(select(KnowledgeBaseEntry).order_by(KnowledgeBaseEntry.id))
    entries = list(result.scalars().all())
    service = get_rag_service()
    await service._retrieval.sync_async(entries, rebuild=rebuild)
    await db.commit()
    service.mark_synced()
    return {"synced": len(entries), "synced_count": len(entries), "rebuild": rebuild}


@router.put("/api/knowledge-base/")
async def regenerate_kb(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Delete all KB entries and regenerate defaults from the product catalog, then sync to vector store."""
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
            is_user_injected=False,
            trust_tier="system",
            owner_id=None,
        )
        db.add(entry)
    await db.commit()
    result = await db.execute(select(KnowledgeBaseEntry).order_by(KnowledgeBaseEntry.id))
    entries = list(result.scalars().all())
    service = get_rag_service()
    await service._retrieval.sync_async(entries, rebuild=True)
    await db.commit()
    service.mark_synced()
    return {"regenerated": True, "entries": len(defaults), "synced": len(entries)}


@router.get("/api/rag-stats/", include_in_schema=False)
async def rag_stats(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    ids_result = await db.execute(select(KnowledgeBaseEntry.embedding_id))
    embed_ids = list(ids_result.scalars().all())
    db_documents = len(embed_ids)
    unsynced = sum(1 for value in embed_ids if not value)
    service = get_rag_service()
    stats = service.get_stats(db_documents=db_documents)
    indexed = stats["indexed_chunks"]
    stats["in_sync"] = unsynced == 0 and (db_documents == 0 or indexed > 0)
    return stats


@router.post("/api/knowledge-base/trace")
async def kb_trace(
    body: RagTraceIn,
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Run retrieval only. No generation. Used by the trace inspector."""
    level = body.defense_level if body.defense_level is not None else user.defense_level
    service = get_rag_service()
    trace = await service.retrieve_trace(
        body.query,
        user_id=user.id,
        level=level,
        top_k=body.top_k,
        hybrid=body.hybrid,
    )
    return {
        "query": trace["query"],
        "rewritten_query": trace["rewritten_query"],
        "top_k": trace["top_k"],
        "candidates": [_candidate_api(c) for c in trace["candidates"]],
        "token_budget": trace["token_budget"],
        "controls_applied": trace["controls_applied"],
        "citations": trace.get("citations") or [],
    }
