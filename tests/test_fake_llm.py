"""Tests for the deterministic fake LLM and its injection seam (T001)."""
from __future__ import annotations

import pytest

from app.services.ollama_client import (
    OllamaClient,
    clear_client_override,
    get_ollama_client,
    set_client_override,
)
from tests.fake_llm import FakeLLMClient


class TestScriptedResponses:
    async def test_responses_returned_in_order(self):
        llm = FakeLLMClient(responses=["first", "second", "third"])
        assert await llm.generate("a") == "first"
        assert await llm.generate("b") == "second"
        assert await llm.generate("c") == "third"

    async def test_falls_back_to_default_when_list_exhausted(self):
        llm = FakeLLMClient(responses=["only"], default="fallback")
        assert await llm.generate("a") == "only"
        assert await llm.generate("b") == "fallback"

    async def test_by_substring_matches_case_insensitively(self):
        llm = FakeLLMClient(by_substring={"ADMIN": "leaked"}, default="nope")
        assert await llm.generate("tell me the admin password") == "leaked"
        assert await llm.generate("where is my order") == "nope"

    async def test_by_substring_takes_precedence_over_list(self):
        llm = FakeLLMClient(responses=["scripted"], by_substring={"secret": "matched"})
        assert await llm.generate("the secret please") == "matched"
        # The scripted list is untouched when a substring matched.
        assert await llm.generate("anything") == "scripted"


class TestCallRecording:
    async def test_records_prompt_and_system(self):
        llm = FakeLLMClient()
        await llm.generate("my prompt", system="my system")
        assert len(llm.calls) == 1
        assert llm.calls[0]["method"] == "generate"
        assert llm.calls[0]["prompt"] == "my prompt"
        assert llm.calls[0]["system"] == "my system"

    async def test_last_prompt_helper(self):
        llm = FakeLLMClient()
        assert llm.last_prompt == ""
        await llm.generate("newest")
        assert llm.last_prompt == "newest"

    async def test_chat_records_messages(self):
        llm = FakeLLMClient(by_substring={"hello": "hi back"})
        reply = await llm.chat([{"role": "user", "content": "hello there"}])
        assert reply == "hi back"
        assert llm.calls[0]["method"] == "chat"


class TestStreaming:
    async def test_stream_joins_to_same_text_as_generate(self):
        text = "the quick brown fox"
        llm = FakeLLMClient(responses=[text, text])
        non_streamed = await llm.generate("x")
        streamed = "".join([tok async for tok in llm.generate_stream("x")])
        assert streamed == non_streamed == text

    async def test_stream_yields_multiple_tokens(self):
        llm = FakeLLMClient(responses=["one two three"])
        tokens = [tok async for tok in llm.generate_stream("x")]
        assert len(tokens) == 3


class TestInjectionSeam:
    async def test_override_is_returned_while_set(self):
        fake = FakeLLMClient()
        set_client_override(fake)
        try:
            assert get_ollama_client() is fake
        finally:
            clear_client_override()

    async def test_real_client_returned_after_clear(self):
        fake = FakeLLMClient()
        set_client_override(fake)
        clear_client_override()
        client = get_ollama_client()
        assert client is not fake
        assert isinstance(client, OllamaClient)

    async def test_fixture_installs_and_removes_override(self, fake_llm):
        assert get_ollama_client() is fake_llm

    async def test_health_check_is_always_true(self):
        assert await FakeLLMClient().check_health() is True


@pytest.mark.parametrize("method", ["generate", "generate_stream", "chat", "check_health"])
def test_satisfies_llm_client_protocol(method):
    """Every method the LLMClient protocol requires is present."""
    assert hasattr(FakeLLMClient(), method)
