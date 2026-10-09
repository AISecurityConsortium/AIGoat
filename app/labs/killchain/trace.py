"""Execution trace. Each event is written by the code that did the thing, in the same request."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.killchain import KcEvent

# Event kinds, grouped the way the UI colours them.
INGEST_KINDS = frozenset({
    "review_submitted", "ticket_created", "attachment_uploaded", "content_extracted", "cache_hit",
    "connector_memory_write", "agent_memory_write", "ingest_clean",
})
MAX_TEXT = 3000


class KillChainError(Exception):
    """A request the lab refuses. ``status`` maps to the HTTP code."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def new_op_id() -> str:
    return f"ex-{secrets.token_hex(4)}"


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat(timespec="milliseconds")


def clip(value: Any, limit: int = MAX_TEXT) -> Any:
    """Bound anything that goes into the trace, so one huge value cannot bloat the table."""
    if isinstance(value, str):
        return value if len(value) <= limit else value[:limit] + "..."
    if isinstance(value, dict):
        return {str(k): clip(v, limit) for k, v in list(value.items())[:40]}
    if isinstance(value, (list, tuple)):
        return [clip(v, limit) for v in list(value)[:40]]
    return value


async def emit(
    db: AsyncSession,
    user_id: int,
    op_id: str,
    kind: str,
    title: str,
    *,
    status: str = "ok",
    detail: dict[str, Any] | None = None,
    refs: dict[str, Any] | None = None,
) -> KcEvent:
    row = KcEvent(
        user_id=user_id,
        op_id=op_id,
        kind=kind,
        status=status,
        title=title[:240],
        detail=clip(detail or {}),
        refs=clip(refs or {}),
    )
    db.add(row)
    await db.commit()
    return row


def event_view(row: KcEvent) -> dict[str, Any]:
    return {
        "id": row.id,
        "op_id": row.op_id,
        "kind": row.kind,
        "status": row.status,
        "title": row.title,
        "detail": row.detail or {},
        "refs": row.refs or {},
        "created_at": iso(row.created_at),
    }


async def list_events(db: AsyncSession, user_id: int, *, after: int = 0, limit: int = 300) -> list[dict[str, Any]]:
    query = select(KcEvent).where(KcEvent.user_id == user_id, KcEvent.id > after)
    if after:
        rows = (await db.execute(query.order_by(KcEvent.id).limit(limit))).scalars().all()
    else:
        newest = (await db.execute(query.order_by(KcEvent.id.desc()).limit(limit))).scalars().all()
        rows = list(reversed(newest))
    return [event_view(row) for row in rows]


async def count_events(db: AsyncSession, user_id: int, kind: str, status: str | None = None) -> int:
    query = select(func.count()).select_from(KcEvent).where(KcEvent.user_id == user_id, KcEvent.kind == kind)
    if status:
        query = query.where(KcEvent.status == status)
    return int((await db.execute(query)).scalar() or 0)
