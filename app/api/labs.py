"""Labs API route handlers.

Lab definitions are loaded from ``config/labs.yml`` via the
lab manifest loader. This module contains only thin route handlers.
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.lab_loader import get_all_labs, get_lab_dict
from app.models import LabSession, User

router = APIRouter(prefix="", tags=["labs"])


def get_lab_definition(lab_id: str) -> dict[str, Any] | None:
    """Public helper used by chat.py to resolve lab metadata."""
    return get_lab_dict(lab_id)


@router.get("/api/labs/")
async def list_labs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """List all labs from config/labs.yml with the current user's session progress."""
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id)
    )
    sessions = {s.lab_id: s for s in result.scalars().all()}
    out: list[dict] = []
    for lab in get_all_labs():
        sess = sessions.get(lab.id)
        out.append({
            "id": lab.id,
            "name": lab.name,
            "owasp": lab.owasp,
            "status": lab.status,
            "defense_override": lab.defense_override,
            "description": lab.description,
            "started_at": sess.started_at.isoformat() if sess else None,
            "completed_at": sess.completed_at.isoformat() if sess and sess.completed_at else None,
            "reset_count": sess.reset_count if sess else 0,
        })
    return out


@router.post("/api/labs/{lab_id}/reset")
async def reset_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Reset a lab session for the current user, clearing completion status."""
    lab_def = get_lab_dict(lab_id)
    if not lab_def:
        raise HTTPException(status_code=404, detail="Lab not found")
    if lab_def.get("status") == "coming_soon":
        raise HTTPException(status_code=400, detail="Lab coming soon")
    result = await db.execute(
        select(LabSession).where(
            LabSession.user_id == user.id,
            LabSession.lab_id == lab_id,
        )
    )
    sess = result.scalar_one_or_none()
    if sess:
        sess.completed_at = None
        sess.reset_count = (sess.reset_count or 0) + 1
        await db.commit()
        await db.refresh(sess)
        return {"reset": True, "lab_id": lab_id, "reset_count": sess.reset_count}
    new_sess = LabSession(user_id=user.id, lab_id=lab_id, reset_count=1)
    db.add(new_sess)
    await db.commit()
    return {"reset": True, "lab_id": lab_id, "reset_count": 1}
