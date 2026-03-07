from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.order import Order


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    defense_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    profile: Mapped["UserProfile | None"] = relationship(
        "UserProfile", uselist=False, back_populates="user"
    )
    orders: Mapped[list["Order"]] = relationship(
        "Order", back_populates="user"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(254), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    zip_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(50), nullable=False, default="US")
    profile_picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    card_number: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    card_type: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    card_holder: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    expiry_month: Mapped[str] = mapped_column(String(2), nullable=False, default="")
    expiry_year: Mapped[str] = mapped_column(String(4), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User", back_populates="profile", foreign_keys=[user_id]
    )
