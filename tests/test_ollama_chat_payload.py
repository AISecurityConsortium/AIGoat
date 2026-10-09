"""The Ollama chat adapter sends the system prompt as a ``role: system`` message.

Ollama's ``/api/chat`` has no top-level ``system`` field (``/api/generate`` does). A key it does
not know is dropped without an error, so the model answered without the system prompt, the
retrieved context, or any standing note. Every other test stubs the client above the adapter, so
nothing looked at what is actually posted. These tests drive the real ``OllamaClient`` over an
in-memory transport (offline) and add one live canary that skips when Ollama is not running.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.core.config import get_settings
from app.services.ollama_client import OllamaClient

SYSTEM = "You are the shop assistant. Follow the policy below.\n\n## Policy\nKeep replies short."
USER = {"role": "user", "content": "What is the policy?"}


def _client(handler) -> OllamaClient:
    """A real OllamaClient whose HTTP layer is an in-memory transport."""
    client = OllamaClient(base_url="http://ollama.test", model="test-model")
    client._http = httpx.AsyncClient(base_url="http://ollama.test", transport=httpx.MockTransport(handler))
    return client


def _recorder(reply: dict[str, Any] | None = None, status: int = 200):
    """A handler that records every request and answers with ``reply``."""
    seen: list[httpx.Request] = []
    body = reply if reply is not None else {"message": {"role": "assistant", "content": "ok"}}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(status, json=body)

    return handler, seen


def _visible_to_model_on_api_chat(body: dict[str, Any]) -> str:
    """What /api/chat can render into the prompt: ``messages`` and ``tools`` only.

    This models the documented request schema. The live canary below checks it against a real server.
    """
    return "\n".join(str(m.get("content") or "") for m in body.get("messages") or [])


class TestPayloadShape:
    def test_system_is_the_first_message_and_not_a_top_level_field(self):
        payload = OllamaClient("http://x", "m")._chat_payload([USER], system=SYSTEM)
        assert "system" not in payload
        assert payload["messages"][0] == {"role": "system", "content": SYSTEM}
        assert payload["messages"][1] == USER

    def test_no_system_adds_no_message(self):
        payload = OllamaClient("http://x", "m")._chat_payload([USER])
        assert payload["messages"] == [USER]
        assert "system" not in payload

    def test_empty_system_adds_no_message(self):
        payload = OllamaClient("http://x", "m")._chat_payload([USER], system="")
        assert payload["messages"] == [USER]

    def test_system_comes_before_the_whole_history_in_order(self):
        call = {"role": "assistant", "content": "", "tool_calls": [
            {"type": "function", "function": {"name": "lookup_order", "arguments": {"order_id": 7}}},
        ]}
        result = {"role": "tool", "tool_name": "lookup_order", "content": '{"status": "shipped"}'}
        payload = OllamaClient("http://x", "m")._chat_payload([USER, call, result], system=SYSTEM)
        assert [m["role"] for m in payload["messages"]] == ["system", "user", "assistant", "tool"]
        assert payload["messages"][2] is call
        assert payload["messages"][3] is result

    def test_the_callers_list_is_not_modified(self):
        history = [USER]
        OllamaClient("http://x", "m")._chat_payload(history, system=SYSTEM)
        assert history == [USER]

    def test_a_system_message_the_caller_already_holds_follows_the_system_argument(self):
        earlier = {"role": "system", "content": "Earlier instruction."}
        payload = OllamaClient("http://x", "m")._chat_payload([earlier, USER], system=SYSTEM)
        assert [m["content"] for m in payload["messages"][:2]] == [SYSTEM, "Earlier instruction."]

    def test_options_tools_and_model_are_forwarded_untouched(self):
        options = {"temperature": 0, "top_p": 0.9, "top_k": 40, "num_predict": 256}
        tools = [{"type": "function", "function": {"name": "lookup_order", "description": "d", "parameters": {
            "type": "object", "properties": {"order_id": {"type": "integer"}}, "required": ["order_id"],
        }}}]
        payload = OllamaClient("http://x", "default-model")._chat_payload(
            [USER], system=SYSTEM, options=options, tools=tools, model="override-model",
        )
        assert payload["options"] == options
        assert payload["options"]["temperature"] == 0
        assert payload["tools"] == tools
        assert payload["model"] == "override-model"
        assert payload["stream"] is False

    def test_no_options_means_no_options_key(self):
        payload = OllamaClient("http://x", "m")._chat_payload([USER], system=SYSTEM)
        assert "options" not in payload
        assert "tools" not in payload


class TestWireRequest:
    async def test_chat_posts_the_system_prompt_as_a_message_to_api_chat(self):
        handler, seen = _recorder()
        client = _client(handler)
        reply = await client.chat([USER], system=SYSTEM, options={"temperature": 0})
        assert reply == "ok"
        assert len(seen) == 1 and seen[0].url.path == "/api/chat"
        body = json.loads(seen[0].content)
        assert set(body) == {"model", "messages", "stream", "options"}
        assert "system" not in body
        assert body["messages"][0] == {"role": "system", "content": SYSTEM}
        assert SYSTEM in _visible_to_model_on_api_chat(body)

    async def test_tool_definitions_and_history_survive_the_round_trip(self):
        handler, seen = _recorder()
        client = _client(handler)
        tools = [{"type": "function", "function": {"name": "lookup_order", "description": "d", "parameters": {
            "type": "object", "properties": {"order_id": {"type": "integer"}}, "required": ["order_id"],
        }}}]
        call = {"role": "assistant", "content": "", "tool_calls": [
            {"type": "function", "function": {"name": "lookup_order", "arguments": {"order_id": 7}}},
        ]}
        result = {"role": "tool", "tool_name": "lookup_order", "content": '{"status": "shipped"}'}
        await client.chat_turn([USER, call, result], system=SYSTEM, tools=tools)
        body = json.loads(seen[0].content)
        assert body["tools"] == tools
        assert body["messages"] == [{"role": "system", "content": SYSTEM}, USER, call, result]

    async def test_native_tool_calls_are_still_parsed(self):
        reply = {"message": {"role": "assistant", "content": "", "tool_calls": [
            {"function": {"name": "lookup_order", "arguments": {"order_id": 7}}},
        ]}}
        handler, _ = _recorder(reply)
        turn = await _client(handler).chat_turn([USER], system=SYSTEM)
        assert turn.tool_calls == [{"name": "lookup_order", "arguments": {"order_id": 7}}]
        assert turn.assistant_message is not None
        assert turn.assistant_message["role"] == "assistant"
        assert turn.assistant_message["tool_calls"][0]["function"]["name"] == "lookup_order"

    async def test_string_tool_arguments_are_decoded(self):
        reply = {"message": {"role": "assistant", "content": "", "tool_calls": [
            {"function": {"name": "lookup_order", "arguments": '{"order_id": 9}'}},
        ]}}
        handler, _ = _recorder(reply)
        turn = await _client(handler).chat_turn([USER], system=SYSTEM)
        assert turn.tool_calls == [{"name": "lookup_order", "arguments": {"order_id": 9}}]

    async def test_a_plain_reply_has_no_tool_calls(self):
        handler, _ = _recorder({"message": {"role": "assistant", "content": "Short answer."}})
        turn = await _client(handler).chat_turn([USER], system=SYSTEM)
        assert turn.content == "Short answer."
        assert turn.tool_calls == [] and turn.assistant_message is None

    async def test_a_server_error_still_returns_an_empty_turn(self):
        handler, _ = _recorder({"error": "boom"}, status=500)
        turn = await _client(handler).chat_turn([USER], system=SYSTEM)
        assert turn.content == "" and turn.tool_calls == []

    async def test_generate_keeps_its_top_level_system_field(self):
        """/api/generate does accept ``system``. That path is correct and must not change."""
        handler, seen = _recorder({"response": "hi"})
        assert await _client(handler).generate("prompt text", system=SYSTEM) == "hi"
        assert seen[0].url.path == "/api/generate"
        assert json.loads(seen[0].content)["system"] == SYSTEM


class TestTheIncorrectShape:
    """The shape that was sent before the fix, and what it did."""

    LEGACY = {"model": "m", "stream": False, "system": SYSTEM, "messages": [USER]}

    def test_a_top_level_system_field_is_invisible_on_api_chat(self):
        assert SYSTEM not in _visible_to_model_on_api_chat(self.LEGACY)

    def test_the_corrected_shape_is_visible(self):
        fixed = OllamaClient("http://x", "m")._chat_payload([USER], system=SYSTEM)
        assert SYSTEM in _visible_to_model_on_api_chat(fixed)

    def test_the_adapter_no_longer_produces_the_incorrect_shape(self):
        payload = OllamaClient("http://x", "m")._chat_payload([USER], system=SYSTEM)
        assert "system" not in payload


async def _live_client() -> OllamaClient:
    settings = get_settings().ollama
    client = OllamaClient(settings.base_url, settings.model, timeout=settings.timeout)
    try:
        listed = await client._http.get("/api/tags")
        names = {row.get("name", "") for row in listed.json().get("models", [])}
    except Exception:
        await client._http.aclose()
        pytest.skip("Ollama is not reachable")
    if not any(name == settings.model or name.split(":")[0] == settings.model for name in names):
        await client._http.aclose()
        pytest.skip(f"model {settings.model!r} is not installed")
    return client


class TestLiveOllama:
    """Needs a running Ollama with the configured model. Skipped otherwise. Everything above is offline."""

    async def test_the_model_actually_receives_the_system_prompt(self):
        client = await _live_client()
        try:
            reply = await client.chat(
                [{"role": "user", "content": "Hello, how are you?"}],
                system="Reply with exactly the single word PINEAPPLE and nothing else.",
                options={"temperature": 0},
            )
        finally:
            await client._http.aclose()
        assert "pineapple" in reply.lower()
