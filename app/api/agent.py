"""Agent run API (P8 / D4) and per-lab memory (D5). Foreground only — D8 rejected."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.memory import delete_note, list_notes, upsert_note
from app.agent.service import cancel_run, get_run, resolve_approval, start_run
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.lab_loader import get_lab_by_id
from app.models import User
from app.schemas.agent import (
    AgentApproveIn,
    AgentMemoryIn,
    AgentMemoryListOut,
    AgentRunIn,
    AgentRunOut,
)

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _require_lab(lab_id: str) -> None:
    if get_lab_by_id(lab_id) is None:
        raise NotFoundError(f"Lab {lab_id} not found")


def _note_out(row) -> dict:
    return {
        "key": row.key,
        "value": row.value,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/runs", response_model=AgentRunOut)
async def create_run(
    body: AgentRunIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await start_run(
        db,
        user,
        lab_id=body.lab_id,
        goal=body.goal,
        session_token=body.session_token,
        defense_level=body.defense_level,
    )


@router.get("/runs/{run_id}", response_model=AgentRunOut)
async def read_run(
    run_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await get_run(db, user, run_id)


@router.post("/runs/{run_id}/approve", response_model=AgentRunOut)
async def approve_run(
    run_id: str,
    body: AgentApproveIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await resolve_approval(
        db,
        user,
        run_id,
        step_seq=body.step_seq,
        decision=body.decision,
    )


@router.post("/runs/{run_id}/cancel", response_model=AgentRunOut)
async def cancel(
    run_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await cancel_run(db, user, run_id)


@router.get("/memory", response_model=AgentMemoryListOut)
async def read_memory(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_lab(lab_id)
    rows = await list_notes(db, user.id, lab_id)
    return {"lab_id": lab_id, "notes": [_note_out(row) for row in rows]}


@router.put("/memory")
async def write_memory(
    body: AgentMemoryIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    _require_lab(body.lab_id)
    row = await upsert_note(db, user.id, body.lab_id, body.key, body.value)
    await db.commit()
    await db.refresh(row)
    return {"lab_id": body.lab_id, **_note_out(row)}


@router.delete("/memory")
async def erase_memory(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    key: str | None = None,
) -> dict:
    _require_lab(lab_id)
    deleted = await delete_note(db, user.id, lab_id, key=key)
    await db.commit()
    return {"deleted": deleted, "lab_id": lab_id, "key": key}
