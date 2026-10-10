"""Agent runs, steps, pending approvals, and lab_session surface token.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-19

D4 pending-action table as a migration, not a --fresh reset.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lab_id", sa.String(length=100), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="running"),
        sa.Column("max_steps", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("defense_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("session_token", sa.String(length=64), nullable=True),
        sa.Column("answer", sa.Text(), nullable=False, server_default=""),
        sa.Column("terminated_reason", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])

    op.create_table(
        "agent_steps",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "run_id",
            sa.String(length=36),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("thought", sa.Text(), nullable=False, server_default=""),
        sa.Column("action", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("action_input", sa.JSON(), nullable=False),
        sa.Column("observation", sa.Text(), nullable=False, server_default=""),
        sa.Column("decision", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("control_id", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_agent_steps_run_id", "agent_steps", ["run_id"])

    op.create_table(
        "pending_approvals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "run_id",
            sa.String(length=36),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_seq", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tool", sa.String(length=100), nullable=False),
        sa.Column("arguments", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pending_approvals_run_id", "pending_approvals", ["run_id"])
    op.create_index("ix_pending_approvals_user_id", "pending_approvals", ["user_id"])

    with op.batch_alter_table("lab_sessions") as batch:
        batch.add_column(sa.Column("surface", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("session_token", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("lab_sessions") as batch:
        batch.drop_column("session_token")
        batch.drop_column("surface")
    op.drop_index("ix_pending_approvals_user_id", table_name="pending_approvals")
    op.drop_index("ix_pending_approvals_run_id", table_name="pending_approvals")
    op.drop_table("pending_approvals")
    op.drop_index("ix_agent_steps_run_id", table_name="agent_steps")
    op.drop_table("agent_steps")
    op.drop_index("ix_agent_runs_user_id", table_name="agent_runs")
    op.drop_table("agent_runs")
