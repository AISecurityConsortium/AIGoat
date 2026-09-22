"""SSE chat stream: tokens arrive, and a dropped client releases the model."""
from __future__ import annotations

import asyncio

from httpx import AsyncClient

from app.api.chat import _stream_model_tokens
from tests.conftest import auth_header
from tests.fake_llm import FakeLLMClient


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def test_chat_stream_emits_tokens(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "stream_tokens")
    async with client.stream(
        "POST",
        "/api/chat/stream",
        headers=auth_header(token),
        json={"message": "hello"},
    ) as resp:
        assert resp.status_code == 200
        body = (await resp.aread()).decode()
    assert "FAKE_RESPONSE" in body
    assert '"done": true' in body
    assert any(call["method"] == "generate_stream" for call in fake_llm.calls)


class _DisconnectAfter:
    def __init__(self, polls: int) -> None:
        self.polls = polls
        self.calls = 0

    async def is_disconnected(self) -> bool:
        self.calls += 1
        return self.calls >= self.polls


class _SlowLLM(FakeLLMClient):
    def __init__(self) -> None:
        super().__init__()
        self.closed = asyncio.Event()

    async def generate_stream(self, prompt: str, system: str = "", options=None, stop=None):
        self.calls.append({"method": "generate_stream", "prompt": prompt, "system": system})
        try:
            yield "partial"
            await asyncio.sleep(30)
            yield "should-not-arrive"
        finally:
            self.closed.set()


async def test_disconnect_closes_model_stream():
    llm = _SlowLLM()
    tokens: list[str] = []
    async for token in _stream_model_tokens(llm, _DisconnectAfter(2), "prompt", None):
        tokens.append(token)
    assert tokens == ["partial"]
    assert llm.closed.is_set()
