"""Rename lab ids to OWASP LLM Top 10 2026 numbering (D18).

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-20

The 2025-to-2026 ranking is a permutation, so every old id remains a valid
id that now means a different lab. Apply the map in two phases (temp
prefix, then final id) so unique (user_id, lab_id, ...) constraints never
collide mid-migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# old id -> 2026 id. Unchanged llm01-1..4 and llm02-1..4 are omitted.
LAB_ID_RENAME = {
    "llm08-6": "llm01-5",
    "llm06-2": "llm03-1",
    "llm06-3": "llm03-2",
    "llm06-1": "llm03-3",
    "llm03-1": "llm04-1",
    "llm04-1": "llm05-1",
    "llm10-1": "llm06-1",
    "llm09-1": "llm07-1",
    "llm07-1": "llm08-1",
    "llm08-1": "llm09-1",
    "llm08-2": "llm09-2",
    "llm08-3": "llm09-3",
    "llm08-4": "llm09-4",
    "llm08-5": "llm09-5",
    "llm05-1": "llm10-1",
}

_TABLES = ("lab_sessions", "agent_runs", "agent_memory")
_TMP_PREFIX = "__ren2026__"


def _apply(mapping: dict[str, str]) -> None:
    for table in _TABLES:
        for old in mapping:
            tmp = f"{_TMP_PREFIX}{old}"
            op.execute(sa.text(f"UPDATE {table} SET lab_id = '{tmp}' WHERE lab_id = '{old}'"))
        for old, new in mapping.items():
            tmp = f"{_TMP_PREFIX}{old}"
            op.execute(sa.text(f"UPDATE {table} SET lab_id = '{new}' WHERE lab_id = '{tmp}'"))


def upgrade() -> None:
    _apply(LAB_ID_RENAME)


def downgrade() -> None:
    inverse = {new: old for old, new in LAB_ID_RENAME.items()}
    _apply(inverse)
