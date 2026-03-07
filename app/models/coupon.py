from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.user import User


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    discount_type: Mapped[str] = mapped_column(String(10), default="percentage", nullable=False)
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    minimum_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    maximum_discount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    usage_limit: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    usage_limit_per_user: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    target_audience: Mapped[str] = mapped_column(String(10), default="all", nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    usages: Mapped[list["CouponUsage"]] = relationship(
        "CouponUsage", back_populates="coupon", cascade="all, delete-orphan"
    )


class CouponUsage(Base):
    __tablename__ = "coupon_usages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    coupon_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    order_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=True
    )
    order_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    coupon: Mapped["Coupon"] = relationship("Coupon", back_populates="usages")
    user: Mapped["User"] = relationship("User")
    order: Mapped["Order | None"] = relationship("Order")
