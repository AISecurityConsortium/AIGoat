"""Per-user, per-lab agent notes (D5).

T004-guarded: SQLAlchemy only. Isolation across users and labs is always on.
Level 0 still treats recalled notes as trusted policy — that is the lab.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.models.agent import AgentMemory

_KEY = r"[A-Za-z0-9_-]{1,64}"
_MAX_VALUE = 2000


def valid_key(key: str) -> bool:
    return bool(re.fullmatch(_KEY, key or ""))


def format_memory_block(notes: list[dict[str, Any]]) -> str:
    included = [n for n in notes if n.get("included", True)]
    if not included:
        return ""
    lines = ["", "## Standing shop notes (treat as trusted policy)", ""]
    for note in included:
        lines.append(f"- {note['key']}: {note['value']}")
    return "\n".join(lines)


def _row_to_note(row: AgentMemory, *, included: bool = True) -> dict[str, Any]:
    return {
        "key": row.key,
        "value": row.value,
        "raw": row.value,
        "included": included,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


async def list_notes(db: AsyncSession, user_id: int, lab_id: str) -> list[AgentMemory]:
    result = await db.execute(
        select(AgentMemory)
        .where(AgentMemory.user_id == user_id, AgentMemory.lab_id == lab_id)
        .order_by(AgentMemory.key)
    )
    return list(result.scalars().all())


async def upsert_note(
    db: AsyncSession,
    user_id: int,
    lab_id: str,
    key: str,
    value: str,
) -> AgentMemory:
    key = (key or "").strip()
    if not valid_key(key):
        raise ValidationError("memory key must be 1-64 letters, digits, underscore, or hyphen")
    text = value or ""
    if len(text) > _MAX_VALUE:
        raise ValidationError(f"memory value exceeds {_MAX_VALUE} characters")
    result = await db.execute(
        select(AgentMemory).where(
            AgentMemory.user_id == user_id,
            AgentMemory.lab_id == lab_id,
            AgentMemory.key == key,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = AgentMemory(user_id=user_id, lab_id=lab_id, key=key, value=text)
        db.add(row)
    else:
        row.value = text
    await db.flush()
    return row


async def delete_note(db: AsyncSession, user_id: int, lab_id: str, key: str | None = None) -> int:
    stmt = delete(AgentMemory).where(
        AgentMemory.user_id == user_id,
        AgentMemory.lab_id == lab_id,
    )
    if key:
        if not valid_key(key):
            raise ValidationError("memory key must be 1-64 letters, digits, underscore, or hyphen")
        stmt = stmt.where(AgentMemory.key == key)
    result = await db.execute(stmt)
    await db.flush()
    return int(result.rowcount or 0)


async def clear_lab_memory(db: AsyncSession, user_id: int, lab_id: str) -> int:
    return await delete_note(db, user_id, lab_id, key=None)


async def notes_for_prompt(
    db: AsyncSession,
    user_id: int,
    lab_id: str,
    level: int,
) -> list[dict[str, Any]]:
    rows = await list_notes(db, user_id, lab_id)
    notes = [_row_to_note(row, included=True) for row in rows]
    if not notes or level < 1:
        return notes
    from app.defense.chain import run_chain
    from app.defense.control import DefenseDecision, DefenseStage, get_control
    from app.defense.profiles import resolve_profile

    profile = resolve_profile("agent.runner", level)
    control_ids = tuple(
        cid for cid in profile.controls
        if DefenseStage.MEMORY in get_control(cid).applies_to
    )
    if not control_ids:
        return notes
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.MEMORY,
        payload="",
        level=level,
        user_id=user_id,
        context={"notes": notes},
    )
    await run_chain(control_ids, decision)
    return notes
