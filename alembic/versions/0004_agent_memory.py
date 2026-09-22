"""Per-user per-lab agent memory (D5).

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-20

Scoped notes for ASI06 labs. Isolation is a platform invariant even at L0.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_memory",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lab_id", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "lab_id", "key", name="uq_agent_memory_user_lab_key"),
    )
    op.create_index("ix_agent_memory_user_id", "agent_memory", ["user_id"])
    op.create_index("ix_agent_memory_lab_id", "agent_memory", ["lab_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_memory_lab_id", table_name="agent_memory")
    op.drop_index("ix_agent_memory_user_id", table_name="agent_memory")
    op.drop_table("agent_memory")
