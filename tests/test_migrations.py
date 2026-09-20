"""Alembic baseline and upgrade tests (T050).

The application test suite still uses ``create_all`` on an in-memory DB
(see tests/conftest.py). These tests drive Alembic against a temporary file
so they do not couple the rest of the suite to migration correctness.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

import app.models as _models
from app.core.database import Base
from app.models.user import User

assert _models  # register every model on Base.metadata

_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(autouse=True)
def _clear_alembic_url():
    yield
    os.environ.pop("ALEMBIC_DATABASE_URL", None)


def _cfg(db_path: Path) -> Config:
    os.environ["ALEMBIC_DATABASE_URL"] = f"sqlite:///{db_path}"
    cfg = Config(str(_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return cfg


def _table_names(db_path: Path) -> set[str]:
    engine = create_engine(f"sqlite:///{db_path}")
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_single_head_revision():
    cfg = Config(str(_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(_ROOT / "alembic"))
    heads = ScriptDirectory.from_config(cfg).get_heads()
    assert len(heads) == 1, f"expected one alembic head, got {heads}"


def test_upgrade_head_from_empty_matches_metadata(tmp_path):
    db_path = tmp_path / "empty.db"
    cfg = _cfg(db_path)
    command.upgrade(cfg, "head")
    db_tables = _table_names(db_path) - {"alembic_version"}
    assert db_tables == set(Base.metadata.tables.keys())


def test_downgrade_then_upgrade_round_trips(tmp_path):
    db_path = tmp_path / "roundtrip.db"
    cfg = _cfg(db_path)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    db_tables = _table_names(db_path) - {"alembic_version"}
    assert db_tables == set(Base.metadata.tables.keys())


def test_stamp_head_on_preexisting_schema_preserves_rows(tmp_path):
    """A pre-Alembic aigoat.db is stamped, not rebuilt. Rows must survive."""
    db_path = tmp_path / "legacy.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(
            User(username="alice", email="alice@example.com", password_hash="hash")
        )
        session.commit()
    engine.dispose()

    cfg = _cfg(db_path)
    command.stamp(cfg, "head")

    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT username FROM users WHERE username = 'alice'")).fetchone()
    engine.dispose()
    assert row is not None
    assert row[0] == "alice"
    assert "alembic_version" in _table_names(db_path)


def test_upgrade_adds_kb_provenance_columns(tmp_path):
    db_path = tmp_path / "cols.db"
    cfg = _cfg(db_path)
    command.upgrade(cfg, "head")
    engine = create_engine(f"sqlite:///{db_path}")
    try:
        columns = {col["name"] for col in inspect(engine).get_columns("knowledge_base_entries")}
    finally:
        engine.dispose()
    assert {
        "trust_tier",
        "owner_id",
        "version",
        "is_latest",
        "valid_until",
        "content_hash",
    } <= columns


def test_upgrade_adds_agent_tables(tmp_path):
    db_path = tmp_path / "agent.db"
    cfg = _cfg(db_path)
    command.upgrade(cfg, "head")
    names = _table_names(db_path)
    assert {"agent_runs", "agent_steps", "pending_approvals"} <= names
    engine = create_engine(f"sqlite:///{db_path}")
    try:
        cols = {col["name"] for col in inspect(engine).get_columns("lab_sessions")}
    finally:
        engine.dispose()
    assert {"surface", "session_token"} <= cols
