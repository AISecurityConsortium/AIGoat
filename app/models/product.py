from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.knowledge import KnowledgeBaseEntry
    from app.models.review import Review


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    detailed_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    specifications: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_sold_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    reviews: Mapped[list["Review"]] = relationship(
        "Review", back_populates="product", cascade="all, delete-orphan"
    )
    knowledge_entries: Mapped[list["KnowledgeBaseEntry"]] = relationship(
        "KnowledgeBaseEntry", back_populates="product", cascade="all, delete-orphan"
    )
