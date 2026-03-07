from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.coupon import Coupon
    from app.models.product import Product
    from app.models.user import User


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    applied_coupon_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True
    )
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    final_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    shipping_first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    shipping_last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    shipping_email: Mapped[str] = mapped_column(String(254), nullable=False, default="")
    shipping_phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    shipping_city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    shipping_state: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    shipping_zip_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    shipping_country: Mapped[str] = mapped_column(String(50), nullable=False, default="US")
    custom_order_id: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    payment: Mapped["Payment | None"] = relationship(
        "Payment", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship("User", back_populates="orders")
    applied_coupon_rel: Mapped["Coupon | None"] = relationship(
        "Coupon", foreign_keys=[applied_coupon_id], lazy="joined"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    card_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    card_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order: Mapped["Order"] = relationship("Order", back_populates="payment")
