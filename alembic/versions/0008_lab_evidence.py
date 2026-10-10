"""Lab attempts and append-only evidence.

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lab_sessions",
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
    )
    # Existing sessions move to a fresh attempt so old fixture directories are left behind.
    op.execute("UPDATE lab_sessions SET attempt = attempt + 1")
    op.create_table(
        "lab_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("lab_id", sa.String(length=100), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(length=32), nullable=False),
        sa.Column("parent_seq", sa.Integer(), nullable=True),
        sa.Column("surface", sa.String(length=32), nullable=False),
        sa.Column("actor", sa.String(length=16), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("server_id", sa.String(length=64), nullable=False),
        sa.Column("claimed_name", sa.String(length=128), nullable=False),
        sa.Column("tool", sa.String(length=100), nullable=False),
        sa.Column("args", sa.JSON(), nullable=False),
        sa.Column("args_sha", sa.String(length=16), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=True),
        sa.Column("decision", sa.String(length=16), nullable=False),
        sa.Column("control_id", sa.String(length=64), nullable=False),
        sa.Column("defense_level", sa.Integer(), nullable=False),
        sa.Column("shown", sa.JSON(), nullable=False),
        sa.Column("raw_digest", sa.String(length=64), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "lab_id", "attempt", "seq", name="uq_lab_events_seq"),
    )
    op.create_index("ix_lab_events_user_id", "lab_events", ["user_id"])
    op.create_index("ix_lab_events_lab_id", "lab_events", ["lab_id"])


def downgrade() -> None:
    op.drop_index("ix_lab_events_lab_id", table_name="lab_events")
    op.drop_index("ix_lab_events_user_id", table_name="lab_events")
    op.drop_table("lab_events")
    op.drop_column("lab_sessions", "attempt")
