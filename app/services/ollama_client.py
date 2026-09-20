from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

import httpx

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.services.llm_protocol import LLMClient

logger = logging.getLogger(__name__)

_ollama_client: "OllamaClient | None" = None

# Testing seam. Never set from config, env, or a request — only from tests.
_client_override: Any = None


def set_client_override(client: Any) -> None:
    """Replace the client returned by get_ollama_client(). Tests only."""
    global _client_override
    _client_override = client


def clear_client_override() -> None:
    global _client_override
    _client_override = None


class OllamaClient:
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout: int = 60,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout, connect=10.0),
        )

    async def check_health(self) -> bool:
        try:
            r = await self._http.get("/api/tags")
            return r.status_code == 200
        except Exception as e:
            logger.error("Ollama health check failed: %s", e)
            return False

    async def generate(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if options:
            payload["options"] = options
        try:
            r = await self._http.post("/api/generate", json=payload)
            r.raise_for_status()
            return r.json().get("response", "")
        except Exception as e:
            logger.error("Ollama generate failed: %s", e)
            return ""

    async def generate_stream(
        self,
        prompt: str,
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]:
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
        }
        if system:
            payload["system"] = system
        if options:
            payload["options"] = options
        try:
            async with self._http.stream(
                "POST", "/api/generate", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    token = chunk.get("response", "")
                    if token:
                        yield token
                    if chunk.get("done"):
                        return
        except Exception as e:
            logger.error("Ollama stream failed: %s", e)

    def _chat_payload(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if options:
            payload["options"] = options
        if tools:
            payload["tools"] = tools
        return payload

    async def chat(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> str:
        turn = await self.chat_turn(
            messages, system=system, options=options, tools=tools, model=model
        )
        return turn.content

    async def chat_turn(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ):
        from app.services.llm_protocol import ChatTurn

        payload = self._chat_payload(messages, system, options, tools, model)
        try:
            r = await self._http.post("/api/chat", json=payload)
            r.raise_for_status()
            msg = r.json().get("message", {}) or {}
            content = msg.get("content") or ""
            tool_calls: list[dict[str, Any]] = []
            for raw in msg.get("tool_calls") or []:
                fn = raw.get("function") if isinstance(raw, dict) else None
                if not isinstance(fn, dict):
                    fn = raw if isinstance(raw, dict) else {}
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                if not isinstance(args, dict):
                    args = {}
                name = fn.get("name") or raw.get("name")
                if name:
                    tool_calls.append({"name": str(name), "arguments": args})
            return ChatTurn(content=content, tool_calls=tool_calls)
        except Exception as e:
            logger.error("Ollama chat failed: %s", e)
            return ChatTurn(content="", tool_calls=[])


def get_ollama_client() -> OllamaClient:
    if _client_override is not None:
        return _client_override
    global _ollama_client
    if _ollama_client is None:
        settings = get_settings()
        _ollama_client = OllamaClient(
            base_url=settings.ollama.base_url,
            model=settings.ollama.model,
            timeout=settings.ollama.timeout,
        )
    return _ollama_client


def get_llm_client() -> LLMClient:
    """Return the active LLM backend as the protocol-typed interface."""
    return get_ollama_client()  # type: ignore[return-value]
