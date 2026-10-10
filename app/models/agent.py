from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lab_id: Mapped[str] = mapped_column(String(100), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="running")
    max_steps: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    defense_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    session_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    terminated_reason: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    steps: Mapped[list["AgentStepRow"]] = relationship(
        "AgentStepRow",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AgentStepRow.seq",
    )
    pending: Mapped[list["PendingApproval"]] = relationship(
        "PendingApproval",
        back_populates="run",
        cascade="all, delete-orphan",
    )


class AgentStepRow(Base):
    __tablename__ = "agent_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    thought: Mapped[str] = mapped_column(Text, nullable=False, default="")
    action: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    action_input: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    observation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    decision: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    control_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="steps")


class PendingApproval(Base):
    __tablename__ = "pending_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool: Mapped[str] = mapped_column(String(100), nullable=False)
    arguments: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="pending")


class AgentMemory(Base):
    """Per-user, per-lab notes. Never global. D5 intentional poison lives here at L0."""

    __tablename__ = "agent_memory"
    __table_args__ = (
        UniqueConstraint("user_id", "lab_id", "key", name="uq_agent_memory_user_lab_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lab_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
