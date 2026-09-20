"""chat.cracky — existing shop/lab chat path behind TargetSurface."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.lab_loader import get_lab_dict
from app.core.token_utils import truncate_chunks_to_budget
from app.defense.control import get_control
from app.defense.nemo_guardrails import get_guardrails_service
from app.defense.pipeline import PipelineResult, defense_pipeline
from app.defense.profiles import resolve_profile
from app.models import Coupon, Order, Product, User
from app.rag.service import get_rag_service
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import (
    build_full_prompt,
    build_sensitive_context,
    load_lab_prompt,
    load_prompt,
)
from app.services.ollama_client import get_ollama_client
from app.surfaces.base import SurfaceRequest, SurfaceResult, TargetSurface
from app.surfaces.transcript import Transcript

logger = logging.getLogger(__name__)


@dataclass
class ChatPrepareResult:
    blocked: ChatResponse | None
    payload: dict[str, Any] | None
    raw_message: str
    input_result: PipelineResult | None
    retrieval_chunks: list[str]


def resolve_chat_level(body: ChatRequest, user: User) -> int:
    lab_def = get_lab_dict(body.lab_id) if body.lab_id else None
    if body.defense_level is not None:
        return body.defense_level
    if lab_def and lab_def.get("defense_override") is not None:
        return int(lab_def["defense_override"])
    return user.defense_level


async def prepare_chat(
    body: ChatRequest,
    user: User,
    db: AsyncSession,
) -> ChatPrepareResult:
    """Defense, prompt, and context. Same behaviour as the pre-P6 ``_prepare_chat``."""
    level = resolve_chat_level(body, user)
    raw_message = body.message
    user_message = body.message
    input_result: PipelineResult | None = None

    if level >= 1:
        input_result = await defense_pipeline.process_input(
            user_message, level, user_id=user.id, surface="chat.cracky"
        )
        if not input_result.allowed:
            logger.info(
                "Defense pipeline blocked input at L%d: %s",
                level,
                input_result.blocked_reason,
            )
            return ChatPrepareResult(
                blocked=ChatResponse(
                    reply=input_result.message, kb_used=False, kb_context_count=0
                ),
                payload=None,
                raw_message=raw_message,
                input_result=input_result,
                retrieval_chunks=[],
            )
        user_message = input_result.message

    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_result = await nemo.check_input(user_message)
            if not nemo_result.allowed:
                logger.info("NeMo Guardrails blocked input: %s", nemo_result.blocked_reason)
                return ChatPrepareResult(
                    blocked=ChatResponse(
                        reply=nemo_result.message, kb_used=False, kb_context_count=0
                    ),
                    payload=None,
                    raw_message=raw_message,
                    input_result=input_result,
                    retrieval_chunks=[],
                )

    lab_prompt = load_lab_prompt(body.lab_id) if body.lab_id else None
    system_prompt = lab_prompt if lab_prompt else load_prompt(level)

    result = await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.profile))
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

    coupons_result = await db.execute(select(Coupon).where(Coupon.is_active == True))
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
    retrieval_chunks: list[str] = []
    if body.use_kb:
        try:
            rag = get_rag_service()
            results = await rag._retrieval.query_async(body.message, top_k=rag._top_k)
            kb_context_count = len(results)
            if results:
                chunks = [r.get("content", "") for r in results if r.get("content")]
                chunks = truncate_chunks_to_budget(chunks, settings.rag.max_context_tokens)
                retrieval_chunks = list(chunks)
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

    return ChatPrepareResult(
        blocked=None,
        payload={
            "prompt": full_prompt,
            "options": options,
            "level": level,
            "kb_used": body.use_kb and kb_context_count > 0,
            "kb_context_count": kb_context_count,
            "user_message": user_message,
        },
        raw_message=raw_message,
        input_result=input_result,
        retrieval_chunks=retrieval_chunks,
    )


def _defense_dict(
    *,
    level: int,
    input_result: PipelineResult | None,
    output_transformed: bool,
) -> dict[str, Any]:
    profile = resolve_profile("chat.cracky", level) if level >= 1 else None
    controls = list(profile.controls) if profile else []
    outcomes: list[dict[str, Any]] = []
    if input_result is not None:
        for outcome in input_result.outcomes:
            if not outcome.control_id:
                continue
            try:
                stages = get_control(outcome.control_id).applies_to
            except KeyError:
                stages = ()
            stage = stages[0].value if stages else "input"
            outcomes.append({
                "control_id": outcome.control_id,
                "action": outcome.action.value,
                "stage": stage,
                "reason": outcome.reason,
            })
    if output_transformed:
        outcomes.append({
            "control_id": "output.moderate",
            "action": "transform",
            "stage": "output",
            "reason": None,
        })
    return {
        "level": level,
        "surface": "chat.cracky",
        "controls_applied": controls,
        "outcomes": outcomes,
    }


def _control_events(transcript: Transcript, input_result: PipelineResult | None) -> None:
    if input_result is None:
        return
    for outcome in input_result.outcomes:
        transcript.add(
            "control_decision",
            control_id=outcome.control_id,
            action=outcome.action.value,
            reason=outcome.reason,
        )


async def generate_moderated_reply(prepared: dict[str, Any]) -> tuple[str, str]:
    """Return ``(raw_reply, visible_reply)`` using the same steps as ``POST /api/chat/``."""
    client = get_ollama_client()
    reply = await client.generate(
        prompt=prepared["prompt"],
        system="",
        options=prepared["options"],
    )
    raw = reply or "I'm sorry, I couldn't process that request."
    visible = raw
    level = prepared["level"]
    if level >= 1:
        visible = await defense_pipeline.moderate_output(visible, level, surface="chat.cracky")
    if level >= 2:
        nemo = get_guardrails_service()
        if nemo.available:
            nemo_out = await nemo.check_output(visible)
            if not nemo_out.allowed:
                visible = nemo_out.message
    return raw, visible


def _to_chat_request(req: SurfaceRequest) -> ChatRequest:
    data = req.input or {}
    return ChatRequest(
        message=str(data.get("message") or ""),
        use_kb=bool(data.get("use_kb", False)),
        lab_id=req.lab_id or data.get("lab_id"),
        defense_level=data.get("defense_level"),
    )


class ChatCrackySurface(TargetSurface):
    id = "chat.cracky"
    name = "Cracky shop chatbot"
    ui = "chat"
    capabilities = ("chat", "stream", "labs")

    def config_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "defense_override": {"type": ["integer", "null"]},
                "prompt_file": {"type": ["string", "null"]},
            },
            "additionalProperties": True,
        }

    async def execute(self, req: SurfaceRequest) -> SurfaceResult:
        body = _to_chat_request(req)
        prepared = await prepare_chat(body, req.user, req.db)
        transcript = Transcript()
        cleaned = (
            prepared.payload["user_message"]
            if prepared.payload is not None
            else (prepared.input_result.message if prepared.input_result else prepared.raw_message)
        )
        transformed = cleaned if cleaned != prepared.raw_message else None
        transcript.add(
            "user_message",
            content=cleaned,
            raw=prepared.raw_message,
            transformed=transformed,
        )
        _control_events(transcript, prepared.input_result)

        if prepared.blocked is not None:
            level = resolve_chat_level(body, req.user)
            transcript.add(
                "model_output",
                content=prepared.blocked.reply,
                raw=prepared.blocked.reply,
            )
            return SurfaceResult(
                result={
                    "reply": prepared.blocked.reply,
                    "kb_used": prepared.blocked.kb_used,
                    "kb_context_count": prepared.blocked.kb_context_count,
                },
                transcript=list(transcript.events),
                defense=_defense_dict(
                    level=level,
                    input_result=prepared.input_result,
                    output_transformed=False,
                ),
                evaluation=None,
            )

        payload = prepared.payload
        assert payload is not None
        for chunk in prepared.retrieval_chunks:
            transcript.add("retrieval", chunks=[{"content": chunk, "truncated": False}])

        raw_reply, visible = await generate_moderated_reply(payload)
        out_transformed = visible if visible != raw_reply else None
        transcript.add(
            "model_output",
            content=visible,
            raw=raw_reply,
            transformed=out_transformed,
        )
        if out_transformed is not None:
            transcript.add(
                "control_decision",
                control_id="output.moderate",
                action="transform",
            )
        return SurfaceResult(
            result={
                "reply": visible,
                "kb_used": payload["kb_used"],
                "kb_context_count": payload["kb_context_count"],
            },
            transcript=list(transcript.events),
            defense=_defense_dict(
                level=payload["level"],
                input_result=prepared.input_result,
                output_transformed=out_transformed is not None,
            ),
            evaluation=None,
        )
