"""Attack sources: product reviews and support-ticket attachments.

Both go through the same deliberately naive pipeline: persist the record, extract what is hidden in
it, cache the extraction, write it to connector memory, derive agent memory from that. The pipeline
never asks whether the hidden text is an instruction. That missing check is the vulnerability.
Only Guardrailed mode adds one: a pattern scan that quarantines content that reads like an instruction.
"""
from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.labs.killchain import guardrails, policy
from app.labs.killchain.constants import (
    MAX_HIDDEN_CHARS,
    MAX_REVIEW_CHARS,
    MAX_TICKET_CHARS,
    MODE_GUARDRAILED,
    SOURCE_ATTACHMENT,
    SOURCE_REVIEW,
)
from app.labs.killchain.memory import (
    cache_key,
    display_review,
    extract_review_hidden,
    sync_agent_memory,
    write_connector_memory,
)
from app.labs.killchain.pdf import PdfRejected, analyze_pdf, validate_upload
from app.labs.killchain.trace import KillChainError, emit, new_op_id
from app.models.killchain import (
    KcAttachment,
    KcConnectorCache,
    KcProduct,
    KcReview,
    KcTicket,
)


async def _extract_with_cache(
    db: AsyncSession,
    user_id: int,
    op_id: str,
    *,
    source_type: str,
    source_id: int,
    material: bytes,
    extract: Any,
    method: str,
) -> tuple[str, bool]:
    """Run ``extract`` unless this exact content was extracted before. Returns (text, cache_hit)."""
    key = cache_key(source_type, material)
    cached = (await db.execute(
        select(KcConnectorCache).where(KcConnectorCache.user_id == user_id, KcConnectorCache.cache_key == key)
    )).scalar_one_or_none()
    if cached is not None:
        cached.hits = (cached.hits or 0) + 1
        await db.commit()
        await emit(
            db, user_id, op_id, "cache_hit", "Connector cache hit: extraction reused",
            status="info", detail={"cache_key": key[:16], "hits": cached.hits},
        )
        return cached.extracted, True
    extracted = extract()
    if extracted:
        db.add(KcConnectorCache(
            user_id=user_id, cache_key=key, source_type=source_type, source_id=source_id, extracted=extracted,
        ))
        await db.commit()
    await emit(
        db, user_id, op_id, "content_extracted",
        f"Extractor ({method}) found {'hidden content' if extracted else 'no hidden content'}",
        status="warning" if extracted else "info",
        detail={"method": method, "extracted": extracted, "length": len(extracted), "cache_key": key[:16]},
        refs={"source_type": source_type, "source_id": source_id},
    )
    return extracted, False


async def _ingest(
    db: AsyncSession,
    user_id: int,
    op_id: str,
    *,
    source_type: str,
    source_id: int,
    material: bytes,
    extract: Any,
    method: str,
    provenance: dict[str, Any],
) -> dict[str, Any]:
    extracted, cache_hit = await _extract_with_cache(
        db, user_id, op_id, source_type=source_type, source_id=source_id,
        material=material, extract=extract, method=method,
    )
    if not extracted:
        await emit(
            db, user_id, op_id, "ingest_clean", "Ingestion finished: nothing was written to memory",
            status="ok", detail={"source_type": source_type, "source_id": source_id},
        )
        return {"connector_memory_id": None, "agent_memory_ids": [], "cache_hit": cache_hit}
    mode, _ = await policy.get_mode(db, user_id)
    findings = guardrails.scan_untrusted(extracted) if mode == MODE_GUARDRAILED else []
    connector = await write_connector_memory(
        db, user_id, op_id, source_type=source_type, source_id=source_id, content=extracted,
        provenance={**provenance, "extractor": method, "cache_hit": cache_hit, "hidden": True},
        status="quarantined" if findings else "persistent",
    )
    if findings:
        await emit(
            db, user_id, op_id, "guardrail",
            f"Guardrail {guardrails.RAIL_INGEST} quarantined CM-{connector.id}: hidden content reads like an agent instruction",
            status="blocked",
            detail={
                "rail": guardrails.RAIL_INGEST, "findings": findings, "connector_memory_id": connector.id,
                "agent_memory_derived": False,
                "note": "The record is kept for audit. It is never copied into agent memory.",
            },
            refs={"connector_memory_id": connector.id},
        )
    derived = await sync_agent_memory(db, user_id, op_id, reason="ingest")
    await db.commit()
    return {
        "connector_memory_id": connector.id,
        "agent_memory_ids": [row.id for row in derived],
        "cache_hit": cache_hit,
        "quarantined": bool(findings),
    }


async def find_product(db: AsyncSession, user_id: int, ref: str | int) -> KcProduct | None:
    text = str(ref).strip()
    if not text:
        return None
    rows = (await db.execute(select(KcProduct).where(KcProduct.user_id == user_id))).scalars().all()
    for row in rows:
        if text.isdigit() and row.id == int(text):
            return row
        if row.sku.lower() == text.lower():
            return row
    lowered = text.lower()
    matches = [row for row in rows if lowered in row.name.lower()]
    return matches[0] if len(matches) == 1 else None


async def submit_review(
    db: AsyncSession,
    user_id: int,
    username: str,
    *,
    product: str | int,
    rating: int,
    text: str,
    hidden: str = "",
    author: str = "",
) -> dict[str, Any]:
    text = (text or "").strip()
    hidden = (hidden or "").strip()
    if not text:
        raise KillChainError("Write a review first.")
    if len(text) > MAX_REVIEW_CHARS or len(hidden) > MAX_HIDDEN_CHARS:
        raise KillChainError("The review is too long.")
    if not 1 <= int(rating) <= 5:
        raise KillChainError("The rating must be between 1 and 5.")
    row_product = await find_product(db, user_id, product)
    if row_product is None:
        raise KillChainError("Unknown product.", 404)
    # The hidden note rides inside the stored review as an HTML comment, so it is part of the real record.
    body = text if not hidden else f"{text}\n<!-- {hidden.replace('-->', '--&gt;')} -->"
    review = KcReview(
        user_id=user_id,
        product_id=row_product.id,
        author=(author or username or "shopper").strip()[:80],
        rating=int(rating),
        body=body,
        seeded=False,
    )
    db.add(review)
    await db.commit()
    op_id = new_op_id()
    await emit(
        db, user_id, op_id, "review_submitted",
        f"Review {review.id} submitted for {row_product.name}",
        detail={
            "review_id": review.id, "product": row_product.sku, "rating": review.rating,
            "shown_to_shoppers": display_review(body), "stored_body": body,
            "contains_markup_comment": "<!--" in body,
        },
        refs={"review_id": review.id},
    )
    outcome = await _ingest(
        db, user_id, op_id,
        source_type=SOURCE_REVIEW, source_id=review.id,
        material=body.encode("utf-8"),
        extract=lambda: extract_review_hidden(body),
        method="html-comment reader",
        provenance={
            "review_id": review.id, "product": row_product.sku, "author": review.author, "rating": review.rating,
        },
    )
    return {"review_id": review.id, "execution_id": op_id, **outcome}


async def create_ticket(db: AsyncSession, user_id: int, *, subject: str, body: str) -> KcTicket:
    subject = (subject or "").strip()
    body = (body or "").strip()
    if not subject or not body:
        raise KillChainError("A ticket needs a subject and a message.")
    if len(subject) > 200 or len(body) > MAX_TICKET_CHARS:
        raise KillChainError("The ticket is too long.")
    ticket = KcTicket(user_id=user_id, subject=subject, body=body, status="open", seeded=False)
    db.add(ticket)
    await db.commit()
    await emit(
        db, user_id, new_op_id(), "ticket_created", f"Support ticket {ticket.id} created",
        detail={"ticket_id": ticket.id, "subject": subject}, refs={"ticket_id": ticket.id},
    )
    return ticket


async def attach_pdf(
    db: AsyncSession,
    user_id: int,
    ticket_id: int,
    *,
    filename: str,
    content_type: str,
    data: bytes,
) -> dict[str, Any]:
    ticket = (await db.execute(
        select(KcTicket).where(KcTicket.id == ticket_id, KcTicket.user_id == user_id)
    )).scalar_one_or_none()
    if ticket is None:
        raise KillChainError("Unknown ticket.", 404)
    existing = (await db.execute(
        select(KcAttachment.id).where(KcAttachment.ticket_id == ticket_id, KcAttachment.user_id == user_id)
    )).first()
    if existing is not None:
        raise KillChainError("This ticket already has an attachment.", 409)
    try:
        name = validate_upload(filename, content_type, data)
        analysis = analyze_pdf(data)
    except PdfRejected as exc:
        raise KillChainError(str(exc)) from exc
    digest = hashlib.sha256(data).hexdigest()
    attachment = KcAttachment(
        user_id=user_id,
        ticket_id=ticket_id,
        filename=name,
        content_type="application/pdf",
        size_bytes=len(data),
        sha256=digest,
        data=data,
        visible_text=analysis.visible_text,
        hidden_text=analysis.hidden_text,
        full_text=analysis.full_text,
        spans=[span.as_dict() for span in analysis.spans],
    )
    db.add(attachment)
    await db.commit()
    op_id = new_op_id()
    await emit(
        db, user_id, op_id, "attachment_uploaded", f"Attachment {name} uploaded to ticket {ticket_id}",
        detail={
            "attachment_id": attachment.id, "ticket_id": ticket_id, "filename": name,
            "size_bytes": len(data), "sha256": digest, "pages": analysis.pages,
            "visible_characters": len(analysis.visible_text), "hidden_runs": sum(1 for s in analysis.spans if s.hidden),
        },
        refs={"attachment_id": attachment.id, "ticket_id": ticket_id},
    )
    outcome = await _ingest(
        db, user_id, op_id,
        source_type=SOURCE_ATTACHMENT, source_id=attachment.id,
        material=data,
        extract=lambda: analysis.hidden_text,
        method="pdf text-layer reader",
        provenance={
            "attachment_id": attachment.id, "ticket_id": ticket_id, "filename": name, "sha256": digest,
        },
    )
    return {"attachment_id": attachment.id, "ticket_id": ticket_id, "execution_id": op_id, **outcome}
