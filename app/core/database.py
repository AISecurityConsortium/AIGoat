from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import get_settings

Base = declarative_base()

engine = create_async_engine(
    get_settings().database.url,
    echo=False,
)
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create missing tables from SQLAlchemy metadata.

    Kept for tests (`tests/conftest.py` builds an in-memory schema with
    ``create_all``) and for Alembic-less fresh bootstraps. Production schema
    changes go through ``alembic upgrade head``; do not add columns here and
    expect existing databases to pick them up.
    """
    import app.models as _models  # noqa: F401 — register models with Base.metadata
    assert _models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
