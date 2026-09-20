"""Add knowledge_base_entries provenance / ACL columns.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-18

Additive only. Existing rows get trust_tier='user', version=1, is_latest=1.
owner_id and valid_until stay NULL. Incremental RAG sync fills content_hash.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("knowledge_base_entries") as batch:
        batch.add_column(
            sa.Column("trust_tier", sa.String(length=32), server_default="user", nullable=False)
        )
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("version", sa.Integer(), server_default="1", nullable=False))
        batch.add_column(sa.Column("is_latest", sa.Boolean(), server_default="1", nullable=False))
        batch.add_column(sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("content_hash", sa.String(length=64), nullable=True))
        batch.create_foreign_key(
            "fk_kb_owner",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("knowledge_base_entries") as batch:
        batch.drop_constraint("fk_kb_owner", type_="foreignkey")
        batch.drop_column("content_hash")
        batch.drop_column("valid_until")
        batch.drop_column("is_latest")
        batch.drop_column("version")
        batch.drop_column("owner_id")
        batch.drop_column("trust_tier")
