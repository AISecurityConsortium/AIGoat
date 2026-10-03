"""Record an MCP lab as completed when the post-defense score says so."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.lab_loader import get_lab_by_id
from app.models import LabSession


async def record_lab_result(db: AsyncSession | None, user: Any, lab_id: str | None, evaluation: dict | None) -> None:
    if db is None or not lab_id or not evaluation or not evaluation.get("exploit_triggered"):
        return
    if getattr(user, "id", None) is None:
        return
    lab = get_lab_by_id(lab_id)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = result.scalar_one_or_none()
    if sess is None:
        sess = LabSession(
            user_id=user.id,
            lab_id=lab_id,
            started_at=now,
            completed_at=now,
            surface=lab.surface if lab else None,
            session_token=secrets.token_hex(16),
        )
        db.add(sess)
    elif sess.completed_at is None:
        sess.completed_at = now
    else:
        return
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
