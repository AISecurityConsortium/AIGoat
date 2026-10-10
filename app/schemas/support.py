from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    body: str
    username: str
    attachment_name: str | None = None
    created_at: datetime | None = None


class TicketOut(BaseModel):
    id: int
    subject: str
    body: str
    status: str
    username: str
    created_at: datetime | None = None
    messages: list[MessageOut] = Field(default_factory=list)


class TicketStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|closed)$")
