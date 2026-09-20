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


@pytest.fixture(autouse=True)
def silent_telemetry(monkeypatch):
    """Stop defense telemetry writing into the developer's real aigoat.db.

    TelemetryLogger.log fires asyncio.create_task against
    app.core.database.async_session, which is bound to ./aigoat.db. The get_db
    dependency override does not cover it, so any test touching the L1+ defense
    path would otherwise persist rows outside the in-memory test database.
    """
    from app.defense.telemetry import TelemetryLogger

    async def _noop(self, data: dict) -> None:
        return None

    monkeypatch.setattr(TelemetryLogger, "_write_to_db", _noop)


@pytest.fixture
def fake_llm():
    """Install a deterministic LLM for the duration of one test.

    Yields the FakeLLMClient so the test can script responses and assert on
    the prompts that were built.
    """
    from app.services.ollama_client import clear_client_override, set_client_override
    from tests.fake_llm import FakeLLMClient

    client = FakeLLMClient()
    set_client_override(client)
    yield client
    clear_client_override()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def isolate_rag(tmp_path, monkeypatch):
    """Keep RAG tests off the developer's chroma_db and MiniLM weights."""
    from app.core.config import get_settings
    from app.rag.embeddings import clear_embedding_override, set_embedding_override
    from app.rag.service import reset_rag_service
    from tests.fake_embed import HashEmbeddingService

    settings = get_settings()
    monkeypatch.setattr(settings.rag, "chroma_path", str(tmp_path / "chroma"))
    set_embedding_override(HashEmbeddingService())
    reset_rag_service()
    yield
    reset_rag_service()
    clear_embedding_override()
