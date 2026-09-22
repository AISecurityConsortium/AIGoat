from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

import httpx

from app.core.config import get_settings

if TYPE_CHECKING:
    from app.services.llm_protocol import LLMClient

logger = logging.getLogger(__name__)


def _next_stream(stream: Any) -> Any:
    nxt = getattr(stream, "_stream", None)
    if nxt is not None:
        return nxt
    core = getattr(stream, "_httpcore_stream", None)
    return getattr(core, "_stream", None) if core is not None else None


def _ollama_socket(resp: Any):
    """Walk httpx's stream wrappers to the socket Ollama is writing to."""
    stream = getattr(resp, "stream", None)
    seen: set[int] = set()
    while stream is not None and id(stream) not in seen:
        seen.add(id(stream))
        core = getattr(stream, "_httpcore_stream", None)
        connection = getattr(core, "_connection", None)
        if connection is None:
            inner = getattr(core, "_stream", None)
            connection = getattr(inner, "_connection", None)
        network = getattr(connection, "_network_stream", None)
        if network is not None and hasattr(network, "get_extra_info"):
            sock = network.get_extra_info("socket")
            if sock is not None:
                return sock
        stream = _next_stream(stream)
    return None


def _close_socket(sock: Any) -> None:
    # uvloop's transport socket rejects shutdown(); closing the fd still
    # drops the TCP connection and unblocks the pending read.
    fileno = -1
    try:
        fileno = sock.fileno()
    except Exception:
        return
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except Exception:
        pass
    if fileno != -1:
        try:
            os.close(fileno)
        except OSError:
            pass


async def _force_close_stream(resp: Any) -> None:
    """Close the Ollama socket even if a read is in progress.

    ``Response.aclose()`` takes the HTTP connection lock that the reader is
    holding, so it waits until the next token instead of stopping the model.
    """
    sock = _ollama_socket(resp)
    if sock is None:
        logger.warning("Could not reach the Ollama socket to stop generation")
        return
    _close_socket(sock)

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
        stop: asyncio.Event | None = None,
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
        stopper: asyncio.Task | None = None
        try:
            async with self._http.stream(
                "POST", "/api/generate", json=payload
            ) as resp:
                resp.raise_for_status()
                if stop is not None:

                    async def _close_on_stop() -> None:
                        await stop.wait()
                        await _force_close_stream(resp)

                    stopper = asyncio.create_task(_close_on_stop())
                try:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        if token:
                            yield token
                        if chunk.get("done"):
                            return
                finally:
                    if stopper is not None and not stopper.done():
                        stopper.cancel()
        except Exception as e:
            if stop is None or not stop.is_set():
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
