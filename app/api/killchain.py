"""Agentic Kill Chain workbench API (lab ``killchain-1``). Staff only, scoped to the caller's own lab data."""
from __future__ import annotations

import re
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.labs.killchain import agent, ingest, service
from app.labs.killchain.constants import INVOICE_FIXTURE, INVOICE_FIXTURE_NAME, MAX_UPLOAD_BYTES
from app.labs.killchain.pdf import PdfRejected, analyze_pdf, validate_upload
from app.labs.killchain.seed import ensure_baseline
from app.labs.killchain.trace import KillChainError, list_events
from app.models.killchain import KcAttachment
from app.models.user import User

router = APIRouter(prefix="/api/killchain", tags=["killchain"])

Admin = Annotated[User, Depends(get_current_admin)]
Db = Annotated[AsyncSession, Depends(get_db)]


def _http(exc: KillChainError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.message)


class ModeIn(BaseModel):
    mode: str


class ReviewIn(BaseModel):
    product: str = Field(min_length=1, max_length=120)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=2000)
    hidden: str = Field(default="", max_length=2000)
    author: str = Field(default="", max_length=80)


class TurnIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    model: str | None = Field(default=None, max_length=80)


class DecisionIn(BaseModel):
    decision: str


class StorefrontIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    product: str = Field(min_length=1, max_length=120)


@router.get("/state")
async def get_state(user: Admin, db: Db) -> dict[str, Any]:
    return await service.snapshot(db, user.id)


@router.get("/events")
async def get_events(
    user: Admin, db: Db, after: Annotated[int, Query(ge=0)] = 0
) -> dict[str, Any]:
    await ensure_baseline(db, user.id)
    return {"events": await list_events(db, user.id, after=after)}


@router.get("/examples")
async def get_examples(user: Admin) -> dict[str, Any]:
    return service.examples()


@router.get("/models")
async def get_models(user: Admin) -> dict[str, Any]:
    """Installed Ollama models. The lab works with whichever the learner picks, or the configured default."""
    settings = get_settings()
    default = settings.ollama.model
    names: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            reply = await client.get(f"{settings.ollama.base_url.rstrip('/')}/api/tags")
            if reply.status_code == 200:
                names = sorted({str(item.get("name")) for item in reply.json().get("models", []) if item.get("name")})
    except (httpx.HTTPError, ValueError):
        names = []
    return {"default": default, "available": bool(names), "models": names}


@router.post("/mode")
async def post_mode(body: ModeIn, user: Admin, db: Db) -> dict[str, Any]:
    try:
        return await service.set_mode(db, user.id, body.mode)
    except KillChainError as exc:
        raise _http(exc) from exc


@router.post("/reviews")
async def post_review(body: ReviewIn, user: Admin, db: Db) -> dict[str, Any]:
    try:
        await ensure_baseline(db, user.id)
        return await ingest.submit_review(
            db, user.id, user.username, product=body.product, rating=body.rating,
            text=body.text, hidden=body.hidden, author=body.author,
        )
    except KillChainError as exc:
        raise _http(exc) from exc


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    return data


@router.post("/tickets")
async def post_ticket(
    user: Admin,
    db: Db,
    subject: Annotated[str, Form(max_length=200)],
    body: Annotated[str, Form(max_length=2000)],
    file: Annotated[UploadFile | None, File()] = None,
) -> dict[str, Any]:
    try:
        await ensure_baseline(db, user.id)
        data = b""
        if file is not None and file.filename:
            data = await _read_upload(file)
            # Validate before the ticket exists, so a bad file does not leave a half-created ticket.
            try:
                validate_upload(file.filename, file.content_type or "", data)
                analyze_pdf(data)
            except PdfRejected as exc:
                raise KillChainError(str(exc)) from exc
        ticket = await ingest.create_ticket(db, user.id, subject=subject, body=body)
        result: dict[str, Any] = {"ticket_id": ticket.id, "attachment": None}
        if data and file is not None:
            result["attachment"] = await ingest.attach_pdf(
                db, user.id, ticket.id, filename=file.filename or "", content_type=file.content_type or "", data=data,
            )
        return result
    except KillChainError as exc:
        raise _http(exc) from exc


@router.post("/tickets/{ticket_id}/attachment")
async def post_attachment(
    ticket_id: int, user: Admin, db: Db, file: Annotated[UploadFile, File()]
) -> dict[str, Any]:
    try:
        await ensure_baseline(db, user.id)
        data = await _read_upload(file)
        return await ingest.attach_pdf(
            db, user.id, ticket_id, filename=file.filename or "", content_type=file.content_type or "", data=data,
        )
    except KillChainError as exc:
        raise _http(exc) from exc


@router.get("/attachments/{attachment_id}")
async def get_attachment(attachment_id: int, user: Admin, db: Db) -> dict[str, Any]:
    try:
        return await service.attachment_evidence(db, user.id, attachment_id)
    except KillChainError as exc:
        raise _http(exc) from exc


def _download(data: bytes, filename: str) -> Response:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:80] or "download.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


@router.get("/attachments/{attachment_id}/file")
async def get_attachment_file(attachment_id: int, user: Admin, db: Db) -> Response:
    row = (await db.execute(
        select(KcAttachment).where(KcAttachment.id == attachment_id, KcAttachment.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No such attachment.")
    return _download(row.data, row.filename)


@router.get("/fixtures/invoice.pdf")
async def get_invoice_fixture(user: Admin) -> Response:
    """The repository's invoice fixture. It is the same file for every learner."""
    return _download(INVOICE_FIXTURE.read_bytes(), INVOICE_FIXTURE_NAME)


@router.post("/turn")
async def post_turn(body: TurnIn, user: Admin, db: Db) -> dict[str, Any]:
    try:
        return await agent.start_turn(db, user, body.message, body.model)
    except KillChainError as exc:
        raise _http(exc) from exc


@router.post("/approvals/{approval_id}/decision")
async def post_decision(approval_id: int, body: DecisionIn, user: Admin, db: Db) -> dict[str, Any]:
    try:
        return await agent.decide(db, user, approval_id, body.decision)
    except KillChainError as exc:
        raise _http(exc) from exc


@router.post("/storefront/coupon")
async def post_storefront_coupon(body: StorefrontIn, user: Admin, db: Db) -> dict[str, Any]:
    """Try a coupon the way a shopper would at the storefront. Used to contrast with the agent's pricing."""
    try:
        return await service.storefront_coupon(db, user.id, body.code, body.product)
    except KillChainError as exc:
        raise _http(exc) from exc


@router.post("/cleanup/{kind}")
async def post_cleanup(kind: str, user: Admin, db: Db) -> dict[str, Any]:
    try:
        result = await service.run_cleanup(db, user.id, kind)
    except KillChainError as exc:
        raise _http(exc) from exc
    return {"kind": kind, "result": result, "state": await service.snapshot(db, user.id)}
