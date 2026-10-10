from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class LabSession(Base):
    __tablename__ = "lab_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lab_id: Mapped[str] = mapped_column(String(100), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reset_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    surface: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    session_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class LabEvent(Base):
    """Append-only evidence for one learner attempt at a lab."""

    __tablename__ = "lab_events"
    __table_args__ = (
        UniqueConstraint("user_id", "lab_id", "attempt", "seq", name="uq_lab_events_seq"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lab_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    request_id: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    parent_seq: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    surface: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    actor: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    server_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    claimed_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    tool: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    args: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    args_sha: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    ok: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    decision: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    control_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    defense_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    shown: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    raw_digest: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    provenance: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
