"""Customer support tickets. Any logged-in learner can plant a ticket."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.models import SupportMessage, SupportTicket, User
from app.schemas.support import MessageCreate, MessageOut, TicketCreate, TicketOut

router = APIRouter(prefix="", tags=["support"])

MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024


def _upload_dir() -> Path:
    path = Path(get_settings().app.media_dir).resolve().parent / "support_uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _display_name(raw: str) -> str:
    name = Path(raw or "attachment").name.replace("\x00", "").strip()
    return (name or "attachment")[:180]


async def save_attachment(upload: Any) -> tuple[str, str]:
    """Store bytes under a generated name. The caller's filename is display-only."""
    data = await upload.read()
    if not data:
        raise ValidationError("The attachment is empty")
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise ValidationError("Attachment must be 2 MB or smaller")
    stored = uuid.uuid4().hex
    target = _upload_dir() / stored
    target.write_bytes(data)
    original = getattr(upload, "filename", None) or "attachment"
    return stored, _display_name(str(original))


def _message_out(message: SupportMessage) -> MessageOut:
    return MessageOut(
        id=message.id,
        body=message.body,
        username=message.user.username if message.user else "",
        attachment_name=message.attachment_name,
        created_at=message.created_at,
    )


def _ordered(ticket: SupportTicket) -> list[SupportMessage]:
    return sorted(ticket.messages or [], key=lambda row: row.id)


def ticket_payload(ticket: SupportTicket) -> dict[str, Any]:
    messages = [_message_out(row).model_dump() for row in _ordered(ticket)]
    return {
        "id": ticket.id,
        "subject": ticket.subject,
        "body": ticket.body,
        "status": ticket.status,
        "username": ticket.user.username if ticket.user else "",
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "messages": messages,
    }


def _out(ticket: SupportTicket) -> TicketOut:
    return TicketOut(
        id=ticket.id,
        subject=ticket.subject,
        body=ticket.body,
        status=ticket.status,
        username=ticket.user.username if ticket.user else "",
        created_at=ticket.created_at,
        messages=[_message_out(row) for row in _ordered(ticket)],
    )


def _load_options():
    return (
        joinedload(SupportTicket.user),
        selectinload(SupportTicket.messages).joinedload(SupportMessage.user),
    )


async def _get_ticket(db: AsyncSession, ticket_id: int) -> SupportTicket:
    result = await db.execute(
        select(SupportTicket).options(*_load_options()).where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise NotFoundError("Ticket not found")
    return ticket


def _require_reader(ticket: SupportTicket, user: User) -> None:
    if ticket.user_id != user.id and not user.is_staff:
        raise ForbiddenError("You cannot read this ticket")


async def add_message(
    db: AsyncSession,
    ticket: SupportTicket,
    user: User,
    body: str,
    *,
    attachment_stored: str | None = None,
    attachment_name: str | None = None,
) -> SupportTicket:
    await db.refresh(ticket, attribute_names=["messages"])
    ticket.messages.append(SupportMessage(
        user_id=user.id,
        body=body.strip(),
        attachment_stored=attachment_stored,
        attachment_name=attachment_name,
    ))
    await db.commit()
    return await _get_ticket(db, ticket.id)


@router.post("/api/support/tickets/", response_model=TicketOut)
async def create_ticket(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TicketOut:
    stored = None
    attachment_name = None
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        subject = str(form.get("subject") or "").strip()
        text = str(form.get("body") or "").strip()
        upload = form.get("file")
        if upload is not None and getattr(upload, "filename", None):
            stored, attachment_name = await save_attachment(upload)
        if not subject or not text:
            raise ValidationError("Subject and message are required")
        if len(subject) > 200 or len(text) > 4000:
            raise ValidationError("Subject or message is too long")
    else:
        payload = TicketCreate.model_validate(await request.json())
        subject = payload.subject.strip()
        text = payload.body.strip()
    ticket = SupportTicket(user_id=user.id, subject=subject, body=text, status="open")
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    ticket = await add_message(
        db,
        ticket,
        user,
        text,
        attachment_stored=stored,
        attachment_name=attachment_name,
    )
    return _out(ticket)


@router.get("/api/support/tickets/", response_model=list[TicketOut])
async def list_my_tickets(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TicketOut]:
    result = await db.execute(
        select(SupportTicket)
        .options(*_load_options())
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.id.desc())
    )
    return [_out(row) for row in result.scalars().all()]


@router.post("/api/support/tickets/{ticket_id}/messages/", response_model=TicketOut)
async def reply_to_ticket(
    ticket_id: int,
    body: MessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TicketOut:
    ticket = await _get_ticket(db, ticket_id)
    if ticket.user_id != user.id:
        raise ForbiddenError("You cannot reply to this ticket")
    if ticket.status != "open":
        raise ValidationError("This ticket is closed")
    ticket = await add_message(db, ticket, user, body.body)
    return _out(ticket)


@router.get("/api/support/tickets/{ticket_id}/messages/{message_id}/file")
async def download_attachment(
    ticket_id: int,
    message_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    ticket = await _get_ticket(db, ticket_id)
    _require_reader(ticket, user)
    message = next((row for row in ticket.messages if row.id == message_id), None)
    if message is None or not message.attachment_stored:
        raise NotFoundError("Attachment not found")
    path = (_upload_dir() / message.attachment_stored).resolve()
    if path.parent != _upload_dir().resolve() or not path.is_file():
        raise NotFoundError("Attachment not found")
    return FileResponse(path, filename=message.attachment_name or "attachment")
