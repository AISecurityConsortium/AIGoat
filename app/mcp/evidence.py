"""Append-only evidence for MCP labs. Apache side: this module owns the DB rows.

Evaluator-facing types live in ``app/challenges`` (CC BY-NC-SA) and must not
be imported here in the other direction. Rows are plain dicts.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.challenges.evidence import EvidenceEvent
from app.models.lab import LabEvent, LabSession

MAX_EVENTS = 500
_locks: dict[tuple[int, str], asyncio.Lock] = {}


def _lock(user_id: int, lab_id: str) -> asyncio.Lock:
    key = (user_id, lab_id)
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    return lock


def _cap_value(value: Any, limit: int = 2048) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[:limit]
    if isinstance(value, dict):
        return {str(key): _cap_value(item, limit) for key, item in list(value.items())[:40]}
    if isinstance(value, list):
        return [_cap_value(item, limit) for item in value[:40]]
    return value


def learner_view(events: list[Any]) -> list[dict[str, Any]]:
    """Sanitized projection. Raw stored fields never leave the server."""
    rows = []
    for event in events:
        shown = event.shown if isinstance(getattr(event, "shown", None), dict) else {}
        excerpt = json.dumps(shown, default=str)
        if len(excerpt) > 200:
            excerpt = excerpt[:200]
        rows.append({
            "seq": event.seq,
            "kind": event.kind,
            "server_id": event.server_id,
            "claimed_name": str(getattr(event, "claimed_name", "") or ""),
            "tool": event.tool,
            "args": _cap_value(event.args, 120) if isinstance(getattr(event, "args", None), dict) else {},
            "ok": event.ok,
            "decision": event.decision,
            "excerpt": excerpt,
        })
    return rows


def to_evidence(row: LabEvent) -> EvidenceEvent:
    return EvidenceEvent(
        seq=row.seq,
        kind=row.kind,
        server_id=row.server_id or "",
        tool=row.tool or "",
        args=row.args if isinstance(row.args, dict) else {},
        ok=row.ok,
        decision=row.decision or "",
        shown=row.shown if isinstance(row.shown, dict) else {},
        claimed_name=row.claimed_name or "",
        data=row.data if isinstance(row.data, dict) else {},
        parent_seq=row.parent_seq,
    )


async def load_evidence(db: AsyncSession, user_id: int, lab_id: str) -> list[EvidenceEvent]:
    attempt = await current_attempt(db, user_id, lab_id)
    result = await db.execute(
        select(LabEvent).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == lab_id,
            LabEvent.attempt == attempt,
        ).order_by(LabEvent.seq)
    )
    return [to_evidence(row) for row in result.scalars().all()]


async def current_attempt(db: AsyncSession, user_id: int, lab_id: str) -> int:
    result = await db.execute(
        select(LabSession.attempt).where(
            LabSession.user_id == user_id,
            LabSession.lab_id == lab_id,
        )
    )
    attempt = result.scalar_one_or_none()
    return int(attempt or 1)


async def append_events(
    db: AsyncSession | None,
    user_id: int | None,
    lab_id: str | None,
    rows: list[dict[str, Any]],
) -> None:
    """Write one request's events. Sequence numbers are per attempt."""
    if db is None or not lab_id or user_id is None or not rows:
        return
    async with _lock(user_id, lab_id):
        for _try in range(2):
            try:
                await _append_locked(db, user_id, lab_id, rows)
                return
            except IntegrityError:
                await db.rollback()
        return


async def _append_locked(
    db: AsyncSession,
    user_id: int,
    lab_id: str,
    rows: list[dict[str, Any]],
) -> None:
    attempt = await current_attempt(db, user_id, lab_id)
    count_result = await db.execute(
        select(func.count()).select_from(LabEvent).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == lab_id,
            LabEvent.attempt == attempt,
        )
    )
    count = int(count_result.scalar_one() or 0)
    if count >= MAX_EVENTS:
        already = await db.execute(
            select(LabEvent.id).where(
                LabEvent.user_id == user_id,
                LabEvent.lab_id == lab_id,
                LabEvent.attempt == attempt,
                LabEvent.kind == "evidence_truncated",
            )
        )
        if already.scalar_one_or_none() is None and count == MAX_EVENTS:
            seq_result = await db.execute(
                select(func.max(LabEvent.seq)).where(
                    LabEvent.user_id == user_id,
                    LabEvent.lab_id == lab_id,
                    LabEvent.attempt == attempt,
                )
            )
            db.add(_row(
                user_id, lab_id, attempt, int(seq_result.scalar_one() or 0) + 1,
                uuid.uuid4().hex, {"kind": "evidence_truncated", "actor": "system", "surface": "mcp.client"},
            ))
            await db.commit()
        return

    seq_result = await db.execute(
        select(func.max(LabEvent.seq)).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == lab_id,
            LabEvent.attempt == attempt,
        )
    )
    seq = int(seq_result.scalar_one() or 0)
    request_id = uuid.uuid4().hex
    assigned: list[int] = []
    for row in rows:
        if count >= MAX_EVENTS:
            break
        seq += 1
        count += 1
        parent = row.get("parent_index")
        parent_seq = assigned[parent] if isinstance(parent, int) and 0 <= parent < len(assigned) else None
        event = _row(user_id, lab_id, attempt, seq, request_id, row, parent_seq)
        db.add(event)
        assigned.append(seq)
    await db.commit()


def _row(
    user_id: int,
    lab_id: str,
    attempt: int,
    seq: int,
    request_id: str,
    row: dict[str, Any],
    parent_seq: int | None = None,
) -> LabEvent:
    args = _cap_value(row.get("args") or {})
    blob = json.dumps(args, sort_keys=True, default=str)
    return LabEvent(
        user_id=user_id,
        lab_id=lab_id,
        attempt=attempt,
        seq=seq,
        request_id=request_id,
        parent_seq=parent_seq,
        surface=str(row.get("surface") or "mcp.client"),
        actor=str(row.get("actor") or "learner"),
        kind=str(row.get("kind") or "discover"),
        server_id=str(row.get("server_id") or ""),
        claimed_name=str(row.get("claimed_name") or "")[:128],
        tool=str(row.get("tool") or ""),
        args=args if isinstance(args, dict) else {},
        args_sha=hashlib.sha256(blob.encode()).hexdigest()[:12],
        ok=row.get("ok"),
        decision=str(row.get("decision") or ""),
        control_id=str(row.get("control_id") or ""),
        defense_level=int(row.get("defense_level") or 0),
        shown=_cap_value(row.get("shown") or {}),
        raw_digest=str(row.get("raw_digest") or ""),
        provenance=_cap_value(row.get("provenance") or {}),
        data=_cap_value(row.get("data") or {}),
    )
