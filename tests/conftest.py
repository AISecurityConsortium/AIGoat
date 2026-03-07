"""Shared test fixtures for AI Goat backend tests.

Creates an isolated in-memory SQLite database and a configured
HTTPX AsyncClient for each test session so tests never touch the
real database.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    import app.models as _models  # noqa: F401 — register all models
    assert _models
    from app.challenges.engine import init_flag_engine
    init_flag_engine("test-secret-key")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_db() -> AsyncIterator[AsyncSession]:
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def seeded_client(client: AsyncClient) -> AsyncClient:
    """Client with a pre-created demo user (alice) for authenticated tests."""
    await client.post(
        "/api/auth/signup/",
        json={"username": "alice", "password": "password123", "email": "alice@aigoatshop.com"},
    )
    return client


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
