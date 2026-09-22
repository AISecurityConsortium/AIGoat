"""Deterministic stand-in for OllamaClient.

Lets tests exercise the chat, defense, and evaluator code paths without a
running Ollama server and without downloading a model. Satisfies
``app.services.llm_protocol.LLMClient``.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any


class FakeLLMClient:
    """Scripted LLM.

    Responses are chosen in this order:
      1. the first ``by_substring`` key found in the prompt (case-insensitive)
      2. the next entry in ``responses``
      3. ``default``
    """

    def __init__(
        self,
        responses: list[str] | None = None,
        by_substring: dict[str, str] | None = None,
        default: str = "FAKE_RESPONSE",
        turns: list[dict[str, Any]] | None = None,
    ) -> None:
        self._responses = list(responses or [])
        self._by_substring = by_substring or {}
        self._default = default
        self._turns = list(turns or [])
        self.calls: list[dict[str, Any]] = []

    def script_turns(self, turns: list[dict[str, Any]]) -> None:
        self._turns = list(turns)

    def _next(self, prompt: str) -> str:
        lowered = prompt.lower()
        for needle, reply in self._by_substring.items():
            if needle.lower() in lowered:
                return reply
        if self._responses:
            return self._responses.pop(0)
        return self._default

    @property
    def last_prompt(self) -> str:
        """Prompt from the most recent call, or '' if never called."""
        if not self.calls:
            return ""
        call = self.calls[-1]
        return call.get("prompt", "")

    async def check_health(self) -> bool:
        return True

    async def generate(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> str:
        self.calls.append({"method": "generate", "prompt": prompt, "system": system})
        return self._next(prompt)

    async def generate_stream(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
        stop: Any = None,
    ) -> AsyncIterator[str]:
        self.calls.append({"method": "generate_stream", "prompt": prompt, "system": system})
        reply = self._next(prompt)
        # Yield word-by-word so the joined stream equals the non-streaming reply.
        parts = reply.split(" ")
        for i, part in enumerate(parts):
            yield part if i == len(parts) - 1 else part + " "

    async def chat(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> str:
        turn = await self.chat_turn(
            messages, system=system, options=options, tools=tools, **kwargs
        )
        return turn.content

    async def chat_turn(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ):
        from app.services.llm_protocol import ChatTurn

        self.calls.append({
            "method": "chat",
            "messages": messages,
            "system": system,
            "tools": tools,
        })
        if self._turns:
            scripted = self._turns.pop(0)
            return ChatTurn(
                content=str(scripted.get("content") or ""),
                tool_calls=list(scripted.get("tool_calls") or []),
            )
        last = messages[-1].get("content", "") if messages else ""
        return ChatTurn(content=self._next(last), tool_calls=[])
