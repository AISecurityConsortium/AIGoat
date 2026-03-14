from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.challenges.engine import verify_flag
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Challenge, ChallengeAttempt, User
from app.schemas.challenge import ChallengeOut, FlagSubmitRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["challenges"])


@router.get("/api/workshop/challenges", response_model=list[ChallengeOut])
async def list_challenges(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChallengeOut]:
    """List all active CTF challenges with the current user's attempt status."""
    result = await db.execute(
        select(Challenge).where(Challenge.is_active == True).order_by(Challenge.id)
    )
    challenges = list(result.scalars().all())
    attempts_result = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.challenge_id.in_(c.id for c in challenges),
        )
    )
    attempts = {a.challenge_id: a for a in attempts_result.scalars().all()}
    out: list[ChallengeOut] = []
    for c in challenges:
        att = attempts.get(c.id)
        out.append(
            ChallengeOut(
                id=c.id,
                title=c.title,
                description=c.description,
                difficulty=c.difficulty,
                points=c.points,
                owasp_ref=c.owasp_ref,
                hints=c.hints,
                where=c.target_route,
                completed=att.completed_at is not None if att else False,
                started=att is not None,
                exploit_triggered=att.exploit_triggered if att else False,
                started_at=att.started_at if att else None,
                completed_at=att.completed_at if att else None,
            )
        )
    return out


@router.post("/api/workshop/challenges/{challenge_id:int}/start")
async def start_challenge(
    challenge_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Start a challenge attempt. Creates a new ChallengeAttempt record for the user."""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id, Challenge.is_active == True)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    existing = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.challenge_id == challenge_id,
            ChallengeAttempt.completed_at.is_(None),
        )
    )
    att = existing.scalar_one_or_none()
    if att:
        return {
            "started_at": att.started_at.isoformat(),
            "exploit_triggered": att.exploit_triggered,
            "message": "Challenge already in progress.",
        }

    attempt = ChallengeAttempt(
        user_id=user.id,
        challenge_id=challenge_id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing2 = await db.execute(
            select(ChallengeAttempt).where(
                ChallengeAttempt.user_id == user.id,
                ChallengeAttempt.challenge_id == challenge_id,
            )
        )
        att2 = existing2.scalar_one_or_none()
        if att2:
            return {
                "started_at": att2.started_at.isoformat(),
                "exploit_triggered": att2.exploit_triggered,
                "message": "Challenge already in progress.",
            }
        raise HTTPException(status_code=409, detail="Could not start challenge. Try again.")
    await db.refresh(attempt)
    return {
        "started_at": attempt.started_at.isoformat(),
        "exploit_triggered": False,
        "message": "Challenge started! Use the chatbot and other app features to trigger the exploit and obtain the flag.",
    }


@router.post("/api/workshop/challenges/{challenge_id:int}/complete")
async def complete_challenge(
    challenge_id: int,
    body: FlagSubmitRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Submit a flag to complete a challenge. The exploit must have been triggered first."""
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id, Challenge.is_active == True)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    attempt_result = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.user_id == user.id,
            ChallengeAttempt.challenge_id == challenge_id,
            ChallengeAttempt.completed_at.is_(None),
        )
    )
    att = attempt_result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=400, detail="No active attempt found. Start the challenge first.")

    if not att.exploit_triggered:
        raise HTTPException(status_code=403, detail="Exploit not yet triggered. You must trigger the exploit through the chatbot before submitting the flag.")

    if not verify_flag(challenge_id, user.id, body.flag):
        raise HTTPException(status_code=400, detail="Invalid flag.")

    now = datetime.now(timezone.utc)
    att.completed_at = now
    att.points_awarded = challenge.points
    await db.commit()
    return {
        "success": True,
        "points": challenge.points,
        "completed_at": now.isoformat(),
    }


@router.get("/api/workshop/leaderboard")
async def leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return the top 20 users ranked by total challenge points."""
    result = await db.execute(
        select(
            User.id,
            User.username,
            func.coalesce(func.sum(ChallengeAttempt.points_awarded), 0).label("total_points"),
            func.count(ChallengeAttempt.completed_at).label("completed_count"),
        )
        .join(ChallengeAttempt, ChallengeAttempt.user_id == User.id)
        .where(ChallengeAttempt.completed_at.isnot(None))
        .group_by(User.id, User.username)
        .order_by(func.sum(ChallengeAttempt.points_awarded).desc())
        .limit(20)
    )
    rows = result.all()
    return [
        {
            "rank": idx + 1,
            "username": row.username,
            "total_points": int(row.total_points),
            "challenges_completed": int(row.completed_count),
        }
        for idx, row in enumerate(rows)
    ]
