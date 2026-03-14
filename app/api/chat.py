from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.labs import get_lab_definition
from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.token_utils import truncate_chunks_to_budget
from app.defense.nemo_guardrails import get_guardrails_service
from app.defense.pipeline import defense_pipeline
from app.models import Coupon, Order, Product, User
from app.rag.service import get_rag_service
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    DefenseLevelOut,
    SetDefenseLevelRequest,
)
from app.services.chat_service import (
    build_full_prompt,
    build_sensitive_context,
    load_lab_prompt,
    load_prompt,
)
from app.services.ollama_client import get_ollama_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["chat"])

DEFENSE_LEVELS = {
    0: {
        "level": 0,
        "name": "Vulnerable",
        "color": "#ef4444",
        "description": "No protection - all attacks succeed",
    },
    1: {
        "level": 1,
        "name": "Hardened",
        "color": "#fbbf24",
        "description": "Basic prompt hardening active",
    },
    2: {
        "level": 2,
        "name": "Guardrailed",
        "color": "#4ade80",
        "description": "Input/output guardrails active",
    },
}

def _get_defense_level(user: User) -> int:
    return user.defense_level


async def _prepare_chat(
    body: ChatRequest,
    user: User,
    db: AsyncSession,
) -> dict | ChatResponse:
    """Shared pre-processing for both streaming and non-streaming chat.

    Precedence rules:
    - lab prompt replaces base system prompt entirely when lab_id is active
    - lab defense_override takes precedence over user.defense_level
    """
    level = _get_defense_level(user)

    lab_def = get_lab_definition(body.lab_id) if body.lab_id else None
    if lab_def and lab_def.get("defense_override") is not None:
        level = lab_def["defense_override"]

    user_message = body.message

    if level >= 1:
        pipeline_result = await defense_pipeline.process_input(
            user_message, level, user_id=user.id
        )
        if not pipeline_result.allowed:
            logger.info("Defense pipeline blocked input at L%d: %s", level, pipeline_result.blocked_reason)
            return ChatResponse(reply=pipeline_result.message, kb_used=False, kb_context_count=0)
        user_message = pipeline_result.message

    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_result = await nemo.check_input(user_message)
            if not nemo_result.allowed:
                logger.info("NeMo Guardrails blocked input: %s", nemo_result.blocked_reason)
                return ChatResponse(reply=nemo_result.message, kb_used=False, kb_context_count=0)

    lab_prompt = load_lab_prompt(body.lab_id) if body.lab_id else None
    system_prompt = lab_prompt if lab_prompt else load_prompt(level)

    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.profile))
    )
    user_with_profile = result.scalar_one()

    orders_stmt = select(Order).options(
        selectinload(Order.payment),
        selectinload(Order.items),
    )
    if level == 1:
        orders_stmt = orders_stmt.where(Order.user_id == user.id)
    orders_result = await db.execute(orders_stmt)
    orders = list(orders_result.scalars().all())

    products_result = await db.execute(select(Product))
    products = list(products_result.scalars().all())

    coupons_result = await db.execute(
        select(Coupon).where(Coupon.is_active == True)
    )
    coupons = list(coupons_result.scalars().all())

    if level == 2:
        user_for_context = None
        orders_for_context: list = []
        coupons_for_context: list = []
    else:
        user_for_context = user_with_profile
        orders_for_context = orders
        coupons_for_context = coupons

    sensitive_context = build_sensitive_context(
        user=user_for_context,
        orders=orders_for_context,
        products=products,
        coupons=coupons_for_context,
        defense_level=level,
    )

    settings = get_settings()

    kb_context = ""
    kb_context_count = 0
    if body.use_kb:
        try:
            rag = get_rag_service()
            results = await rag._retrieval.query_async(body.message, top_k=rag._top_k)
            kb_context_count = len(results)
            if results:
                chunks = [r.get("content", "") for r in results if r.get("content")]
                chunks = truncate_chunks_to_budget(chunks, settings.rag.max_context_tokens)
                kb_context_count = len(chunks)
                kb_context = (
                    "KNOWLEDGE BASE CONTEXT (retrieved from product knowledge base):\n"
                    + "\n---\n".join(chunks)
                )
        except Exception:
            pass

    essential_context = "Product catalog available. Assist with orders when user provides order ID."
    if kb_context:
        essential_context = kb_context + "\n\n" + essential_context

    full_prompt = build_full_prompt(
        system_prompt=system_prompt,
        sensitive_context=sensitive_context,
        essential_context=essential_context,
        message=user_message,
        defense_level=level,
    )
    options = {
        "temperature": settings.chat.temperature,
        "top_p": settings.chat.top_p,
        "top_k": settings.chat.top_k,
        "num_predict": settings.chat.max_tokens,
    }

    return {
        "prompt": full_prompt,
        "options": options,
        "level": level,
        "kb_used": body.use_kb and kb_context_count > 0,
        "kb_context_count": kb_context_count,
        "user_message": user_message,
    }


@router.post("/api/chat/", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatResponse:
    """Send a message to the AI shopping assistant and receive a complete response.

    The message passes through the defense pipeline based on the user's current defense level.
    Optionally include a lab_id to activate a lab-specific system prompt.
    """
    prepared = await _prepare_chat(body, user, db)
    if isinstance(prepared, ChatResponse):
        return prepared

    client = get_ollama_client()
    reply = await client.generate(
        prompt=prepared["prompt"],
        system="",
        options=prepared["options"],
    )
    reply = reply or "I'm sorry, I couldn't process that request."

    level = prepared["level"]
    if level >= 1:
        reply = await defense_pipeline.moderate_output(reply, level)
    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_out = await nemo.check_output(reply)
            if not nemo_out.allowed:
                reply = nemo_out.message

    return ChatResponse(
        reply=reply,
        kb_used=prepared["kb_used"],
        kb_context_count=prepared["kb_context_count"],
    )


@router.post("/api/chat/stream")
async def chat_stream(
    body: ChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """SSE streaming endpoint. Each event is a JSON chunk with a `token` field."""
    prepared = await _prepare_chat(body, user, db)

    if isinstance(prepared, ChatResponse):
        async def blocked_gen():
            data = json.dumps({"token": prepared.reply, "done": True})
            yield f"data: {data}\n\n"
        return StreamingResponse(blocked_gen(), media_type="text/event-stream")

    client = get_ollama_client()

    async def token_gen():
        collected: list[str] = []
        try:
            async for token in client.generate_stream(
                prompt=prepared["prompt"],
                system="",
                options=prepared["options"],
            ):
                collected.append(token)
                data = json.dumps({"token": token, "done": False})
                yield f"data: {data}\n\n"
        except Exception as e:
            logger.error("Stream generation error: %s", e)

        full_reply = "".join(collected)
        if not full_reply:
            full_reply = "I'm sorry, I couldn't process that request."
            data = json.dumps({"token": full_reply, "done": True})
            yield f"data: {data}\n\n"
            return

        level = prepared["level"]
        moderated = full_reply
        replaced = False
        if level >= 1:
            moderated = await defense_pipeline.moderate_output(full_reply, level)
            if moderated != full_reply:
                replaced = True
        if level >= 2:
            nemo = get_guardrails_service()
            if nemo.available:
                nemo_out = await nemo.check_output(moderated)
                if not nemo_out.allowed:
                    moderated = nemo_out.message
                    replaced = True

        if replaced:
            data = json.dumps({"replace": moderated, "done": True})
        else:
            data = json.dumps({"done": True})
        yield f"data: {data}\n\n"

    return StreamingResponse(token_gen(), media_type="text/event-stream")


@router.get("/api/chat/defense-levels", response_model=DefenseLevelOut)
async def get_defense_levels(
    user: Annotated[User, Depends(get_current_user)],
) -> DefenseLevelOut:
    """Return all available defense levels and the user's current selection."""
    current = _get_defense_level(user)
    levels = [DEFENSE_LEVELS[i] for i in sorted(DEFENSE_LEVELS)]
    return DefenseLevelOut(current_level=current, levels=levels)


@router.post("/api/chat/defense-level")
async def set_defense_level(
    body: SetDefenseLevelRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Set the user's defense level (0=Vulnerable, 1=Hardened, 2=Guardrailed)."""
    if body.level not in DEFENSE_LEVELS:
        return {"success": False, "detail": "Invalid level"}
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one()
    db_user.defense_level = body.level
    await db.commit()
    return {"success": True, "level": body.level}


@router.get("/api/chat/defense-level", response_model=DefenseLevelOut)
async def get_defense_level(
    user: Annotated[User, Depends(get_current_user)],
) -> DefenseLevelOut:
    """Return the user's current defense level. Alias for /api/chat/defense-levels."""
    return await get_defense_levels(user)
