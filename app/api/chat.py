from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.defense.nemo_guardrails import get_guardrails_service
from app.defense.pipeline import defense_pipeline
from app.models import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    DefenseLevelOut,
    SetDefenseLevelRequest,
)
from app.services.ollama_client import get_ollama_client
from app.surfaces import ensure_registered
from app.surfaces.base import SurfaceRequest
from app.surfaces.chat_cracky import prepare_chat
from app.surfaces.registry import get_surface

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
    """Shared pre-processing for streaming chat and T006 level-precedence tests.

    Non-streaming ``POST /api/chat/`` goes through ``chat.cracky`` execute so
    the reply matches ``POST /api/surfaces/chat.cracky/execute``.
    """
    prepared = await prepare_chat(body, user, db)
    if prepared.blocked is not None:
        return prepared.blocked
    assert prepared.payload is not None
    return prepared.payload


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
    ensure_registered()
    result = await get_surface("chat.cracky").execute(
        SurfaceRequest(
            user=user,
            db=db,
            lab_id=body.lab_id,
            input={
                "message": body.message,
                "use_kb": body.use_kb,
                "defense_level": body.defense_level,
            },
        )
    )
    return ChatResponse(
        reply=result.result["reply"],
        kb_used=result.result["kb_used"],
        kb_context_count=result.result["kb_context_count"],
        citations=result.result.get("citations") or [],
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
    surface: str | None = Query(default=None),
) -> DefenseLevelOut:
    """Return all available defense levels and the user's current selection."""
    current = _get_defense_level(user)
    levels = [dict(DEFENSE_LEVELS[i]) for i in sorted(DEFENSE_LEVELS)]
    if surface:
        from app.defense.control import get_control
        from app.defense.profiles import resolve_profile

        try:
            for item in levels:
                profile = resolve_profile(surface, int(item["level"]))
                item["intent"] = profile.intent
                item["controls"] = [
                    {
                        "id": cid,
                        "name": get_control(cid).name,
                        "stage": (
                            get_control(cid).applies_to[0].value
                            if get_control(cid).applies_to
                            else ""
                        ),
                        "description": get_control(cid).verifies,
                        "verifies": get_control(cid).verifies,
                    }
                    for cid in profile.controls
                ]
        except ValueError as exc:
            from app.core.exceptions import ValidationError

            raise ValidationError(str(exc)) from exc
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
    surface: str | None = Query(default=None),
) -> DefenseLevelOut:
    """Return the user's current defense level. Alias for /api/chat/defense-levels."""
    return await get_defense_levels(user, surface=surface)
