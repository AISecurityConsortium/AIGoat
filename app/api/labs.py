"""Labs API route handlers.

Lab definitions are loaded from ``config/labs/*.yml`` via the
lab manifest loader. This module contains only thin route handlers.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.lab_loader import get_all_labs, get_lab_by_id, get_lab_dict
from app.core.taxonomy import labs_for_risk, risks_for_lab
from app.models import LabSession, User
from app.schemas.lab import LabOut, LabStartOut

router = APIRouter(prefix="", tags=["labs"])


def get_lab_definition(lab_id: str) -> dict[str, Any] | None:
    """Public helper used by chat.py to resolve lab metadata."""
    return get_lab_dict(lab_id)


def _related_lab_ids(lab_id: str) -> list[str]:
    seen: list[str] = []
    for risk in risks_for_lab(lab_id):
        for other in labs_for_risk(risk.id):
            if other == lab_id or other in seen:
                continue
            seen.append(other)
            if len(seen) >= 5:
                return seen
    return seen


def _lab_out(lab, sess: LabSession | None) -> LabOut:
    expected = {str(k): v for k, v in (lab.expected_by_level or {}).items()}
    return LabOut(
        id=lab.id,
        name=lab.name,
        owasp=lab.owasp,
        status=lab.status,
        defense_override=lab.defense_override,
        description=lab.description,
        started_at=sess.started_at.isoformat() if sess else None,
        completed_at=sess.completed_at.isoformat() if sess and sess.completed_at else None,
        reset_count=sess.reset_count if sess else 0,
        risks=list(lab.risks),
        surface=lab.surface,
        difficulty=lab.difficulty,
        objective=lab.objective,
        prerequisites=list(lab.prerequisites),
        attack_steps=list(lab.attack_steps),
        example_payloads=list(lab.example_payloads),
        expected_by_level=expected,
        remediation=lab.remediation,
        references=list(lab.references),
        challenge_id=lab.challenge_id,
        related_lab_ids=_related_lab_ids(lab.id),
    )


def _matches_filters(
    lab,
    *,
    framework: str | None,
    risk: str | None,
    surface: str | None,
    difficulty: str | None,
    status: str | None,
) -> bool:
    if status and lab.status != status:
        return False
    if surface and lab.surface != surface:
        return False
    if difficulty and lab.difficulty != difficulty:
        return False
    if risk and risk not in lab.risks:
        return False
    if framework and not any(r.startswith(f"{framework}:") for r in lab.risks):
        return False
    return True


@router.get("/api/labs/", response_model=list[LabOut])
async def list_labs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    framework: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    surface: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[LabOut]:
    """List labs from the YAML manifest with the current user's session progress."""
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id)
    )
    sessions = {s.lab_id: s for s in result.scalars().all()}
    out: list[LabOut] = []
    for lab in get_all_labs():
        if not _matches_filters(
            lab,
            framework=framework,
            risk=risk,
            surface=surface,
            difficulty=difficulty,
            status=status,
        ):
            continue
        out.append(_lab_out(lab, sessions.get(lab.id)))
    return out


@router.get("/api/labs/{lab_id}", response_model=LabOut)
async def get_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabOut:
    """Return one lab with session progress for the current user."""
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise NotFoundError(f"Lab {lab_id} not found")
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = result.scalar_one_or_none()
    return _lab_out(lab, sess)


@router.post("/api/labs/{lab_id}/start", response_model=LabStartOut)
async def start_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabStartOut:
    """Create or return a LabSession for the current user."""
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise NotFoundError(f"Lab {lab_id} not found")
    if lab.status == "coming_soon":
        raise HTTPException(status_code=400, detail="Lab coming soon")

    existing = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = existing.scalar_one_or_none()
    if sess:
        return LabStartOut(
            lab_id=lab_id,
            started_at=sess.started_at.isoformat(),
            surface=lab.surface,
            already_started=True,
        )

    sess = LabSession(
        user_id=user.id,
        lab_id=lab_id,
        started_at=datetime.now(timezone.utc),
        surface=lab.surface,
        session_token=secrets.token_hex(16),
    )
    db.add(sess)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing2 = await db.execute(
            select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
        )
        sess2 = existing2.scalar_one_or_none()
        if sess2:
            return LabStartOut(
                lab_id=lab_id,
                started_at=sess2.started_at.isoformat(),
                surface=lab.surface,
                already_started=True,
            )
        raise HTTPException(status_code=409, detail="Could not start lab. Try again.")
    await db.refresh(sess)
    return LabStartOut(
        lab_id=lab_id,
        started_at=sess.started_at.isoformat(),
        surface=lab.surface,
        already_started=False,
    )


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
    new_sess = LabSession(
        user_id=user.id,
        lab_id=lab_id,
        reset_count=1,
        surface=lab_def.get("surface"),
        session_token=secrets.token_hex(16),
    )
    db.add(new_sess)
    await db.commit()
    return {"reset": True, "lab_id": lab_id, "reset_count": 1}
