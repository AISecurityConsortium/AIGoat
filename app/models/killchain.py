"""Agentic Kill Chain lab state.

Every row is owned by one user and is synthetic. Nothing here touches the real shop tables, so
a hard reset can rebuild the whole lab from the seed without side effects on the rest of AI Goat.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _user_fk() -> Mapped[int]:
    return mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)


class KcState(Base):
    __tablename__ = "kc_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="vulnerable")
    # Bumped by every hard reset. A run that started before the reset cannot act afterwards.
    epoch: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    conversation: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcProduct(Base):
    __tablename__ = "kc_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    sku: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    coupon_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class KcReview(Base):
    __tablename__ = "kc_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kc_products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped[str] = mapped_column(String(80), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    # The stored review as the ingestion pipeline sees it. Hidden markup stays in here.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    seeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcTicket(Base):
    __tablename__ = "kc_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    seeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcAttachment(Base):
    __tablename__ = "kc_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    ticket_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kc_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(120), nullable=False)
    content_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    # What a person sees, what the pipeline extracts, and the per-run evidence between them.
    visible_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hidden_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    full_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    spans: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcConnectorMemory(Base):
    """Persistent store of the MCP connector: what ingestion extracted, verbatim."""

    __tablename__ = "kc_connector_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    trust: Mapped[str] = mapped_column(String(16), nullable=False, default="untrusted")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="persistent")
    retrieval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcConnectorCache(Base):
    """Transient extraction cache of the connector. Clearing it leaves persistent memory alone."""

    __tablename__ = "kc_connector_cache"
    __table_args__ = (UniqueConstraint("user_id", "cache_key", name="uq_kc_cache_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted: Mapped[str] = mapped_column(Text, nullable=False)
    hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcAgentMemory(Base):
    """The agent's own long-term notes. Derived from connector memory, loaded into later prompts."""

    __tablename__ = "kc_agent_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    connector_memory_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("kc_connector_memory.id", ondelete="SET NULL"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    topics: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    trust: Mapped[str] = mapped_column(String(16), nullable=False, default="untrusted")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="persistent")
    retrieval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcEvent(Base):
    """Append-only execution trace. Every row is written by the code that performed the action."""

    __tablename__ = "kc_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    op_id: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    refs: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcMail(Base):
    """A simulated outgoing email. It is a database row. Nothing is ever sent."""

    __tablename__ = "kc_mail"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    execution_id: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    approval_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sender: Mapped[str] = mapped_column(String(120), nullable=False)
    recipient: Mapped[str] = mapped_column(String(200), nullable=False)
    bcc: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    subject: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    dataset: Mapped[str] = mapped_column(String(24), nullable=False)
    categories: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="delivered")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class KcApproval(Base):
    """One pending sensitive operation. Bound to the exact tool and arguments by ``args_hash``."""

    __tablename__ = "kc_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    run_id: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    execution_id: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    tool: Mapped[str] = mapped_column(String(64), nullable=False)
    arguments: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    args_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    target: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    categories: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    effects: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    result: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class KcCustomer(Base):
    __tablename__ = "kc_customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    order_ref: Mapped[str] = mapped_column(String(32), nullable=False)
    card_brand: Mapped[str] = mapped_column(String(24), nullable=False)
    card_number: Mapped[str] = mapped_column(String(24), nullable=False)
    billing_city: Mapped[str] = mapped_column(String(80), nullable=False)
    billing_postcode: Mapped[str] = mapped_column(String(16), nullable=False)


class KcCoupon(Base):
    __tablename__ = "kc_coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class KcCheckout(Base):
    """Result of a priced checkout in the lab's simulated cart. Nothing here charges anyone."""

    __tablename__ = "kc_checkouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = _user_fk()
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kc_products.id", ondelete="CASCADE"), nullable=False
    )
    coupon_code: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    list_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    final_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    execution_id: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
