from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    owasp_ref: Mapped[str] = mapped_column(String(20), nullable=False)
    evaluator_key: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    hints: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    target_route: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    attempts: Mapped[list["ChallengeAttempt"]] = relationship(
        "ChallengeAttempt", back_populates="challenge", cascade="all, delete-orphan"
    )


class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "challenge_id", name="uq_one_active_attempt"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    challenge_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    exploit_triggered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    exploit_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship("User")
    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="attempts")
