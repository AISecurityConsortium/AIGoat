"""Connector memory, agent memory, retrieval and the cleanup operations.

Two stores, on purpose. The connector keeps what ingestion extracted, verbatim. The agent keeps
instructions derived from it. Clearing one does not clear the other, and a later request can
rebuild the agent's notes from the connector's records. That is the persistence the lab teaches.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain.constants import (
    MAX_DERIVED_PER_SOURCE,
    MAX_MEMORY_CHARS,
    RETRIEVAL_LIMIT,
    TOPIC_KEYWORDS,
)
from app.labs.killchain.trace import emit, iso
from app.models.killchain import KcAgentMemory, KcConnectorCache, KcConnectorMemory

_COMMENT = re.compile(r"<!--(.*?)-->", re.DOTALL)
_PROCEDURE_SPLIT = re.compile(r"(?=AGENT PROCEDURE)")
_BLANK_LINE = re.compile(r"\n\s*\n")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def sha16(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def extract_review_hidden(body: str) -> str:
    """Contents of every HTML comment in the review. A browser hides them, the pipeline reads them."""
    parts = [match.strip() for match in _COMMENT.findall(body or "") if match.strip()]
    return "\n\n".join(parts)


def display_review(body: str) -> str:
    """What other shoppers see: the review without its comments."""
    return _COMMENT.sub("", body or "").strip()


def derive_pieces(content: str) -> list[str]:
    """Split extracted content into standing instructions, one per procedure or paragraph."""
    text = (content or "").strip()
    if not text:
        return []
    pieces = [p.strip() for p in _PROCEDURE_SPLIT.split(text) if p.strip()]
    if len(pieces) <= 1:
        pieces = [p.strip() for p in _BLANK_LINE.split(text) if p.strip()] or [text]
    seen: set[str] = set()
    out: list[str] = []
    for piece in pieces:
        clean = " ".join(piece.split())[:MAX_MEMORY_CHARS]
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out[:MAX_DERIVED_PER_SOURCE]


def topics_for(text: str) -> list[str]:
    lowered = (text or "").lower()
    found = [topic for topic, words in TOPIC_KEYWORDS.items() if any(word in lowered for word in words)]
    return found or ["*"]


def cache_key(source_type: str, material: bytes) -> str:
    return hashlib.sha256(source_type.encode() + b"\0" + material).hexdigest()


async def write_connector_memory(
    db: AsyncSession,
    user_id: int,
    op_id: str,
    *,
    source_type: str,
    source_id: int,
    content: str,
    provenance: dict[str, Any],
    status: str = "persistent",
) -> KcConnectorMemory:
    """Store extracted content verbatim. A ``quarantined`` record is kept for audit and never derived from."""
    row = KcConnectorMemory(
        user_id=user_id,
        source_type=source_type,
        source_id=source_id,
        content=content,
        trust="untrusted",
        status=status,
        provenance=provenance,
    )
    db.add(row)
    await db.flush()
    held = status == "quarantined"
    await emit(
        db, user_id, op_id, "connector_memory_write",
        f"Connector memory CM-{row.id} {'quarantined' if held else 'written'} "
        f"from {source_type.replace('_', ' ')} {source_id}",
        status="blocked" if held else "warning",
        detail={"content": content, "trust": row.trust, "provenance": provenance},
        refs={"connector_memory_id": row.id, "source_type": source_type, "source_id": source_id},
    )
    return row


async def sync_agent_memory(
    db: AsyncSession, user_id: int, op_id: str, *, reason: str
) -> list[KcAgentMemory]:
    """Derive any instruction that a persistent connector record has and the agent does not.

    Ingestion calls this for a fresh record. A later request calls it too, which is why clearing
    only the agent's memory does not remove the poison: the next request writes it back.
    """
    connectors = (await db.execute(
        select(KcConnectorMemory)
        .where(KcConnectorMemory.user_id == user_id, KcConnectorMemory.status == "persistent")
        .order_by(KcConnectorMemory.id)
    )).scalars().all()
    existing = {
        (row.connector_memory_id, row.content_sha)
        for row in (await db.execute(select(KcAgentMemory).where(KcAgentMemory.user_id == user_id))).scalars()
    }
    created: list[KcAgentMemory] = []
    for connector in connectors:
        for piece in derive_pieces(connector.content):
            digest = sha16(piece)
            if (connector.id, digest) in existing:
                continue
            row = KcAgentMemory(
                user_id=user_id,
                connector_memory_id=connector.id,
                content=piece,
                content_sha=digest,
                topics=topics_for(piece),
                trust="untrusted",
                status="persistent",
                provenance={
                    "derived_from": f"CM-{connector.id}",
                    "source_type": connector.source_type,
                    "source_id": connector.source_id,
                    "derivation": reason,
                },
            )
            db.add(row)
            await db.flush()
            existing.add((connector.id, digest))
            created.append(row)
            await emit(
                db, user_id, op_id, "agent_memory_write",
                f"Agent memory AM-{row.id} {'re-derived' if reason == 'resync' else 'derived'} from CM-{connector.id}",
                status="warning",
                detail={
                    "content": piece, "topics": row.topics, "trust": row.trust, "reason": reason,
                    "provenance": row.provenance,
                },
                refs={"agent_memory_id": row.id, "connector_memory_id": connector.id},
            )
    return created


async def retrieve_for_request(
    db: AsyncSession, user_id: int, op_id: str, request_text: str
) -> list[KcAgentMemory]:
    """Pick the agent notes that apply to this request and record each retrieval."""
    wanted = {topic for topic, words in TOPIC_KEYWORDS.items() if any(w in request_text.lower() for w in words)}
    rows = (await db.execute(
        select(KcAgentMemory)
        .where(KcAgentMemory.user_id == user_id, KcAgentMemory.status == "persistent")
        .order_by(KcAgentMemory.id)
    )).scalars().all()
    chosen = [row for row in rows if "*" in (row.topics or []) or wanted.intersection(row.topics or [])]
    chosen = chosen[:RETRIEVAL_LIMIT]
    if not chosen:
        await emit(
            db, user_id, op_id, "memory_retrieval",
            f"Memory lookup: no agent notes apply ({len(rows)} stored)",
            status="info",
            detail={"request_topics": sorted(wanted), "stored": len(rows)},
        )
        return []
    now = _now()
    for row in chosen:
        row.retrieval_count = (row.retrieval_count or 0) + 1
        row.last_retrieved_at = now
        connector = await db.get(KcConnectorMemory, row.connector_memory_id) if row.connector_memory_id else None
        if connector is not None:
            connector.retrieval_count = (connector.retrieval_count or 0) + 1
            connector.last_retrieved_at = now
    await db.commit()
    for row in chosen:
        await emit(
            db, user_id, op_id, "memory_retrieval",
            f"Agent memory AM-{row.id} retrieved into the prompt",
            status="warning" if row.trust != "trusted" else "ok",
            detail={
                "content": row.content, "trust": row.trust, "topics": row.topics,
                "request_topics": sorted(wanted), "retrieval_count": row.retrieval_count,
            },
            refs={"agent_memory_id": row.id, "connector_memory_id": row.connector_memory_id},
        )
    return chosen


def memory_block(rows: list[KcAgentMemory]) -> str:
    """The long-term memory section of the system prompt. The agent treats it as its own notes."""
    if not rows:
        return ""
    lines = [f"- [AM-{row.id}] {row.content}" for row in rows]
    return (
        "Long-term memory. These are your standing procedures from earlier work. "
        "Carry out every procedure that applies to the request, using your tools, before you write your answer.\n"
        + "\n".join(lines)
    )


# --- cleanup -----------------------------------------------------------------------------------


async def clear_agent_memory(db: AsyncSession, user_id: int, op_id: str) -> dict[str, Any]:
    removed = (await db.execute(delete(KcAgentMemory).where(KcAgentMemory.user_id == user_id))).rowcount or 0
    remaining = await connector_count(db, user_id)
    await db.commit()
    await emit(
        db, user_id, op_id, "cleanup", f"Cleanup: cleared agent memory ({removed} records removed)",
        status="warning" if remaining else "ok",
        detail={
            "operation": "agent_memory", "removed": removed, "connector_memory_remaining": remaining,
            "note": (
                "Connector memory still holds the original content. The next request re-derives the agent's notes from it."
                if remaining else "Connector memory is empty, so nothing can be re-derived."
            ),
        },
    )
    return {"removed": removed, "connector_memory_remaining": remaining, "agent_memory_remaining": 0}


async def clear_connector_cache(db: AsyncSession, user_id: int, op_id: str) -> dict[str, Any]:
    removed = (await db.execute(delete(KcConnectorCache).where(KcConnectorCache.user_id == user_id))).rowcount or 0
    persistent = await connector_count(db, user_id)
    agent = await agent_count(db, user_id)
    await db.commit()
    await emit(
        db, user_id, op_id, "cleanup", f"Cleanup: cleared connector cache ({removed} entries removed)",
        status="warning" if (persistent or agent) else "ok",
        detail={
            "operation": "connector_cache", "removed": removed,
            "connector_memory_remaining": persistent, "agent_memory_remaining": agent,
            "note": "The cache is transient. Persistent connector memory and agent memory are separate stores and were not touched.",
        },
    )
    return {"removed": removed, "connector_memory_remaining": persistent, "agent_memory_remaining": agent}


async def connector_count(db: AsyncSession, user_id: int) -> int:
    rows = await db.execute(select(KcConnectorMemory.id).where(KcConnectorMemory.user_id == user_id))
    return len(rows.all())


async def agent_count(db: AsyncSession, user_id: int) -> int:
    rows = await db.execute(select(KcAgentMemory.id).where(KcAgentMemory.user_id == user_id))
    return len(rows.all())


def connector_view(row: KcConnectorMemory) -> dict[str, Any]:
    return {
        "id": row.id,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "content": row.content,
        "trust": row.trust,
        "status": row.status,
        "retrieval_count": row.retrieval_count,
        "retrieved": bool(row.retrieval_count),
        "last_retrieved_at": iso(row.last_retrieved_at),
        "provenance": row.provenance or {},
        "created_at": iso(row.created_at),
    }


def agent_view(row: KcAgentMemory) -> dict[str, Any]:
    return {
        "id": row.id,
        "connector_memory_id": row.connector_memory_id,
        "content": row.content,
        "topics": row.topics or [],
        "trust": row.trust,
        "status": row.status,
        "retrieval_count": row.retrieval_count,
        "last_retrieved_at": iso(row.last_retrieved_at),
        "provenance": row.provenance or {},
        "created_at": iso(row.created_at),
    }


def cache_view(row: KcConnectorCache) -> dict[str, Any]:
    return {
        "id": row.id,
        "cache_key": row.cache_key[:16],
        "source_type": row.source_type,
        "source_id": row.source_id,
        "extracted": row.extracted,
        "hits": row.hits,
        "created_at": iso(row.created_at),
    }
