"""Agent run API (P8 / D4). Foreground only — D8 rejected background execution."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.service import cancel_run, get_run, resolve_approval, start_run
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import User
from app.schemas.agent import AgentApproveIn, AgentRunIn, AgentRunOut

router = APIRouter(prefix="/api/agent", tags=["agent"])


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
