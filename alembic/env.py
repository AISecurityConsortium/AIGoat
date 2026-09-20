"""Alembic environment.

Uses a *synchronous* SQLite driver even though the app engine is
``sqlite+aiosqlite``. Alembic's default online path is sync; swapping the
scheme here keeps migrations simple and is the chosen option from T050
(async template vs sync-with-driver-swap).
"""
from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.models as _models
from app.core.config import get_settings
from app.core.database import Base

assert _models  # registers every model on Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    """Sync URL for Alembic. Prefer ALEMBIC_DATABASE_URL (tests), else app config."""
    override = os.environ.get("ALEMBIC_DATABASE_URL")
    raw = override if override else get_settings().database.url
    if raw.startswith("sqlite+aiosqlite://"):
        return "sqlite://" + raw[len("sqlite+aiosqlite://"):]
    return raw


config.set_main_option("sqlalchemy.url", _database_url())


def run_migrations_offline() -> None:
    url = _database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {}) or {}
    configuration["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
