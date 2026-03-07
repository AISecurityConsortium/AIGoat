"""Dedicated challenge chat endpoint.

Each challenge gets its own chat context with a challenge-specific prompt.
The main shop chatbot (chat.py) is completely separate and unaware of
challenges.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.challenges.engine import compute_flag
from app.challenges.evaluator import EvalContext, KBEntry
from app.challenges.registry import get_evaluator_by_title
from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.token_utils import truncate_chunks_to_budget
from app.models import (
    Challenge,
    ChallengeAttempt,
    ChatMessage,
    KnowledgeBaseEntry,
    Order,
    Product,
    User,
)
from app.rag.service import get_rag_service
from app.services.ollama_client import get_ollama_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/challenges", tags=["challenge-chat"])

_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts" / "challenges"

CHALLENGE_NEEDS_KB = {3, 7, 8}
CHALLENGE_NEEDS_ORDER_CONTEXT = {9}


class ChallengeChatRequest(BaseModel):
    message: str
    use_kb: bool = False


class ChallengeChatResponse(BaseModel):
    reply: str
    flag: str | None = None
    kb_used: bool = False


def _load_challenge_prompt(challenge_id: int) -> str | None:
    path = _PROMPTS_DIR / f"c{challenge_id}.md"
    if not path.exists():
        # Fallback: try older naming conventions
        for p in _PROMPTS_DIR.glob(f"c{challenge_id}_*.md"):
            return p.read_text()
        return None
    return path.read_text()


def _build_order_context(orders: list, user: User) -> str:
    """Build order context for C9 with shipping emails from all users."""
    lines = [f"Current user: {user.username}, email: {user.email}"]
    for o in orders:
        line = (
            f"Order {o.id} (user_id={o.user_id}): "
            f"total={o.total_amount}, status={o.status}"
        )
        if o.shipping_email:
            line += f", shipping_email={o.shipping_email}"
        lines.append(line)
    return "\n".join(lines)


def _build_product_context(products: list) -> str:
    lines = []
    for p in products:
        lines.append(f"- {p.name}: {p.description} | price INR {p.price}")
    return "\n".join(lines) if lines else ""


@router.post("/{challenge_id}/chat", response_model=ChallengeChatResponse)
async def challenge_chat(
    challenge_id: int,
    body: ChallengeChatRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChallengeChatResponse:
    challenge_result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = challenge_result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    attempt_result = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.challenge_id == challenge_id,
            ChallengeAttempt.completed_at.is_(None),
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(
            status_code=400,
            detail="Challenge not started. Click 'Start Challenge' first.",
        )

    system_prompt = _load_challenge_prompt(challenge_id)
    if not system_prompt:
        system_prompt = _load_challenge_prompt(challenge_id)
        if not system_prompt:
            raise HTTPException(
                status_code=500,
                detail="Challenge prompt file not found",
            )

    products_result = await db.execute(select(Product))
    products = list(products_result.scalars().all())
    product_context = _build_product_context(products)

    order_context = ""
    if challenge_id in CHALLENGE_NEEDS_ORDER_CONTEXT:
        user_result = await db.execute(
            select(User).where(User.id == user.id).options(selectinload(User.profile))
        )
        user_with_profile = user_result.scalar_one()
        orders_result = await db.execute(
            select(Order).options(selectinload(Order.payment))
        )
        orders = list(orders_result.scalars().all())
        order_context = _build_order_context(orders, user_with_profile)

    settings = get_settings()
    kb_context = ""
    kb_entries_structured: list[KBEntry] = []
    kb_used = False
    if body.use_kb and challenge_id in CHALLENGE_NEEDS_KB:
        try:
            rag = get_rag_service()
            results = await rag._retrieval.query_async(body.message, top_k=rag._top_k)
            if results:
                chunks = [r.get("content", "") for r in results if r.get("content")]
                chunks = truncate_chunks_to_budget(chunks, settings.rag.max_context_tokens)
                kb_context = (
                    "KNOWLEDGE BASE CONTEXT:\n" + "\n---\n".join(chunks)
                )
                kb_used = True
                injected_result = await db.execute(
                    select(KnowledgeBaseEntry.content)
                    .where(KnowledgeBaseEntry.is_user_injected == True)
                )
                injected_contents = {row[0] for row in injected_result.all()}
                for chunk in chunks:
                    is_injected = any(
                        chunk in fc or fc in chunk for fc in injected_contents
                    )
                    kb_entries_structured.append(
                        KBEntry(content=chunk, is_user_injected=is_injected)
                    )
        except Exception:
            logger.exception("KB retrieval failed for challenge %d", challenge_id)

    context_parts = []
    if product_context:
        context_parts.append(f"PRODUCT CATALOG:\n{product_context}")
    if order_context:
        context_parts.append(f"REFERENCE DATA:\n{order_context}")
    if kb_context:
        context_parts.append(kb_context)
    context_block = "\n\n".join(context_parts)

    full_prompt = (
        f"{system_prompt}\n\n"
        f"{context_block}\n\n"
        f"User: {body.message}\n"
        f"Cracky:"
    )

    client = get_ollama_client()
    options = {
        "temperature": settings.chat.temperature,
        "top_p": settings.chat.top_p,
        "top_k": settings.chat.top_k,
        "num_predict": settings.chat.max_tokens,
    }
    reply = await client.generate(prompt=full_prompt, system="", options=options)
    reply = reply or "I'm sorry, I couldn't process that request."

    db.add(ChatMessage(
        user_id=user.id, challenge_id=challenge_id,
        role="user", content=body.message,
    ))
    db.add(ChatMessage(
        user_id=user.id, challenge_id=challenge_id,
        role="assistant", content=reply,
    ))
    await db.flush()

    flag: str | None = None
    if attempt.exploit_triggered:
        flag = compute_flag(challenge_id, user.id)
    else:
        evaluator = get_evaluator_by_title(challenge.evaluator_key or challenge.title)
        if evaluator:
            history_result = await db.execute(
                select(ChatMessage)
                .where(
                    ChatMessage.user_id == user.id,
                    ChatMessage.challenge_id == challenge_id,
                )
                .order_by(ChatMessage.id)
            )
            history_rows = list(history_result.scalars().all())
            chat_history = [
                {"role": row.role, "content": row.content} for row in history_rows
            ]
            ctx = EvalContext(
                user_message=body.message,
                model_output=reply,
                chat_history=chat_history,
                kb_entries_used=kb_entries_structured,
                defense_level=0,
            )
            if evaluator.check_exploit(ctx):
                attempt.exploit_triggered = True
                attempt.exploit_timestamp = datetime.now(timezone.utc)
                flag = compute_flag(challenge_id, user.id)
                logger.info(
                    "Challenge %d exploit triggered by user %d",
                    challenge_id, user.id,
                )

    await db.commit()

    if flag:
        reply += f"\n\nOh, it seems I accidentally leaked something: {flag}"

    return ChallengeChatResponse(reply=reply, flag=flag, kb_used=kb_used)
