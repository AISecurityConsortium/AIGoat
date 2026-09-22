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
    assert {"agent_runs", "agent_steps", "pending_approvals", "agent_memory"} <= names
    engine = create_engine(f"sqlite:///{db_path}")
    try:
        cols = {col["name"] for col in inspect(engine).get_columns("lab_sessions")}
        memory_cols = {col["name"] for col in inspect(engine).get_columns("agent_memory")}
    finally:
        engine.dispose()
    assert {"surface", "session_token"} <= cols
    assert {"id", "user_id", "lab_id", "key", "value", "created_at"} <= memory_cols


def test_0005_renames_lab_ids_and_downgrades(tmp_path):
    db_path = tmp_path / "rename.db"
    cfg = _cfg(db_path)
    command.upgrade(cfg, "0004")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (username, email, password_hash, first_name, last_name, "
                "is_staff, is_superuser, is_active, defense_level) "
                "VALUES ('alice', 'a@b.c', 'h', '', '', 0, 0, 1, 0)"
            )
        )
        uid = conn.execute(text("SELECT id FROM users WHERE username = 'alice'")).scalar()
        conn.execute(
            text("INSERT INTO lab_sessions (user_id, lab_id, reset_count) VALUES (:u, 'llm06-2', 0)"),
            {"u": uid},
        )
        conn.execute(
            text("INSERT INTO lab_sessions (user_id, lab_id, reset_count) VALUES (:u, 'llm03-1', 0)"),
            {"u": uid},
        )
        conn.execute(
            text(
                "INSERT INTO agent_runs (id, user_id, lab_id, goal) "
                "VALUES ('run-1', :u, 'llm06-2', 'refund')"
            ),
            {"u": uid},
        )
        conn.execute(
            text(
                "INSERT INTO agent_memory (user_id, lab_id, key, value) "
                "VALUES (:u, 'llm06-2', 'note', 'x')"
            ),
            {"u": uid},
        )
    engine.dispose()

    command.upgrade(cfg, "0005")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        sessions = {row[0] for row in conn.execute(text("SELECT lab_id FROM lab_sessions"))}
        run_lab = conn.execute(text("SELECT lab_id FROM agent_runs WHERE id = 'run-1'")).scalar()
        mem_lab = conn.execute(text("SELECT lab_id FROM agent_memory WHERE key = 'note'")).scalar()
    engine.dispose()
    assert sessions == {"llm03-1", "llm04-1"}
    assert run_lab == "llm03-1"
    assert mem_lab == "llm03-1"

    command.downgrade(cfg, "0004")
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        sessions = {row[0] for row in conn.execute(text("SELECT lab_id FROM lab_sessions"))}
        run_lab = conn.execute(text("SELECT lab_id FROM agent_runs WHERE id = 'run-1'")).scalar()
        mem_lab = conn.execute(text("SELECT lab_id FROM agent_memory WHERE key = 'note'")).scalar()
    engine.dispose()
    assert sessions == {"llm06-2", "llm03-1"}
    assert run_lab == "llm06-2"
    assert mem_lab == "llm06-2"
