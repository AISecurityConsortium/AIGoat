"""Agentic Kill Chain lab: seeded shop data, dual memory, trace, approvals, mock mail.

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _user() -> sa.Column:
    return sa.Column("user_id", sa.Integer(), nullable=False)


def _created() -> sa.Column:
    return sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)


def _table(name: str, *columns: sa.Column, uniques: Sequence[sa.UniqueConstraint] = ()) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        *columns,
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        *uniques,
    )
    op.create_index(f"ix_{name}_user_id", name, ["user_id"])


def upgrade() -> None:
    op.create_table(
        "kc_state",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        _user(),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("epoch", sa.Integer(), nullable=False),
        sa.Column("conversation", sa.JSON(), nullable=False),
        _created(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    _table(
        "kc_products",
        _user(),
        sa.Column("sku", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("coupon_eligible", sa.Boolean(), nullable=False),
    )
    _table(
        "kc_reviews",
        _user(),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("kc_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author", sa.String(length=80), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("seeded", sa.Boolean(), nullable=False),
        _created(),
    )
    op.create_index("ix_kc_reviews_product_id", "kc_reviews", ["product_id"])
    _table(
        "kc_tickets",
        _user(),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("seeded", sa.Boolean(), nullable=False),
        _created(),
    )
    _table(
        "kc_attachments",
        _user(),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("kc_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=120), nullable=False),
        sa.Column("content_type", sa.String(length=80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("visible_text", sa.Text(), nullable=False),
        sa.Column("hidden_text", sa.Text(), nullable=False),
        sa.Column("full_text", sa.Text(), nullable=False),
        sa.Column("spans", sa.JSON(), nullable=False),
        _created(),
    )
    op.create_index("ix_kc_attachments_ticket_id", "kc_attachments", ["ticket_id"])
    _table(
        "kc_connector_memory",
        _user(),
        sa.Column("source_type", sa.String(length=24), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("trust", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("retrieval_count", sa.Integer(), nullable=False),
        sa.Column("last_retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provenance", sa.JSON(), nullable=False),
        _created(),
    )
    _table(
        "kc_connector_cache",
        _user(),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("source_type", sa.String(length=24), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("extracted", sa.Text(), nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False),
        _created(),
        uniques=[sa.UniqueConstraint("user_id", "cache_key", name="uq_kc_cache_key")],
    )
    _table(
        "kc_agent_memory",
        _user(),
        sa.Column(
            "connector_memory_id",
            sa.Integer(),
            sa.ForeignKey("kc_connector_memory.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_sha", sa.String(length=16), nullable=False),
        sa.Column("topics", sa.JSON(), nullable=False),
        sa.Column("trust", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("retrieval_count", sa.Integer(), nullable=False),
        sa.Column("last_retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provenance", sa.JSON(), nullable=False),
        _created(),
    )
    op.create_index("ix_kc_agent_memory_connector_memory_id", "kc_agent_memory", ["connector_memory_id"])
    _table(
        "kc_events",
        _user(),
        sa.Column("op_id", sa.String(length=24), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("refs", sa.JSON(), nullable=False),
        _created(),
    )
    _table(
        "kc_mail",
        _user(),
        sa.Column("execution_id", sa.String(length=24), nullable=False),
        sa.Column("approval_id", sa.Integer(), nullable=True),
        sa.Column("sender", sa.String(length=120), nullable=False),
        sa.Column("recipient", sa.String(length=200), nullable=False),
        sa.Column("bcc", sa.String(length=200), nullable=False),
        sa.Column("subject", sa.String(length=240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("dataset", sa.String(length=24), nullable=False),
        sa.Column("categories", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        _created(),
    )
    _table(
        "kc_approvals",
        _user(),
        sa.Column("run_id", sa.String(length=24), nullable=False),
        sa.Column("execution_id", sa.String(length=24), nullable=False),
        sa.Column("tool", sa.String(length=64), nullable=False),
        sa.Column("arguments", sa.JSON(), nullable=False),
        sa.Column("args_hash", sa.String(length=64), nullable=False),
        sa.Column("action_type", sa.String(length=40), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("target", sa.String(length=240), nullable=False),
        sa.Column("categories", sa.JSON(), nullable=False),
        sa.Column("effects", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        _created(),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    _table(
        "kc_customers",
        _user(),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("order_ref", sa.String(length=32), nullable=False),
        sa.Column("card_brand", sa.String(length=24), nullable=False),
        sa.Column("card_number", sa.String(length=24), nullable=False),
        sa.Column("billing_city", sa.String(length=80), nullable=False),
        sa.Column("billing_postcode", sa.String(length=16), nullable=False),
    )
    _table(
        "kc_coupons",
        _user(),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("value", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=False),
        sa.Column("internal", sa.Boolean(), nullable=False),
    )
    _table(
        "kc_checkouts",
        _user(),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("kc_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("coupon_code", sa.String(length=32), nullable=False),
        sa.Column("list_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("final_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("execution_id", sa.String(length=24), nullable=False),
        _created(),
    )


def downgrade() -> None:
    for name in (
        "kc_checkouts", "kc_coupons", "kc_customers", "kc_approvals", "kc_mail", "kc_events",
        "kc_agent_memory", "kc_connector_cache", "kc_connector_memory", "kc_attachments",
        "kc_tickets", "kc_reviews", "kc_products", "kc_state",
    ):
        op.drop_table(name)
