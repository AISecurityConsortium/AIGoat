"""Backend-neutral, streaming-safe LLM interface.

Any LLM backend (Ollama, OpenAI, Anthropic, local GGUF, etc.) should
implement this protocol so consumer code never depends on transport
details. ``generate_stream`` yields tokens as ``str`` via
``AsyncIterator`` for SSE-compatible streaming.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class ChatTurn:
    """One chat completion, optionally with native tool calls."""

    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)


@runtime_checkable
class LLMClient(Protocol):
    async def generate(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> str: ...

    async def generate_stream(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]: ...

    async def chat(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> str: ...

    async def check_health(self) -> bool: ...
