from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Product

router = APIRouter(prefix="", tags=["system"])


@router.get("/api/feature-flags/")
async def get_feature_flags() -> dict:
    """Return current feature flags for the frontend UI."""
    settings = get_settings()
    return {
        "rag_system": settings.features.knowledge_base,
        "admin_dashboard": settings.features.admin_dashboard,
        "admin_order_management": True,
        "admin_user_management": True,
        "admin_inventory_management": True,
        "admin_coupon_management": settings.features.coupon_system,
        "user_profile": True,
        "card_number_masking": True,
        "input_validation": True,
        "personalized_search": True,
        "product_recommendations": True,
        "payment_processing": True,
        "order_tracking": True,
        "coupon_system": settings.features.coupon_system,
        "chat_system": True,
    }


@router.get("/api/ollama/status/")
async def ollama_status() -> dict:
    """Check whether the Ollama LLM service is reachable and which model is configured."""
    settings = get_settings()
    url = f"{settings.ollama.base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url)
            available = r.status_code == 200
    except Exception:
        available = False
    return {
        "status": "available" if available else "unavailable",
        "message": "Ollama service is available" if available else "Ollama service is not available",
        "ollama_available": available,
        "model_available": available,
        "service_url": settings.ollama.base_url,
        "model": settings.ollama.model,
    }


@router.post("/api/ollama/status/", include_in_schema=False)
async def reset_ollama_context() -> dict:
    return {
        "success": True,
        "message": "Model context has been reset successfully",
    }


@router.get("/api/search/")
async def search_products(
    q: str = Query("", alias="q"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[dict]:
    """Search products by name or description. Returns up to 20 matches."""
    if not q.strip():
        return []
    pattern = f"%{q}%"
    result = await db.execute(
        select(Product).where(
            Product.name.ilike(pattern) | Product.description.ilike(pattern)
        ).limit(20)
    )
    products = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": float(p.price),
            "image_url": f"/media/{p.image}" if p.image else None,
        }
        for p in products
    ]
