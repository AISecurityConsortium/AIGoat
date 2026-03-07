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

    async def chat(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        options: dict[str, Any] | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if options:
            payload["options"] = options
        try:
            r = await self._http.post("/api/chat", json=payload)
            r.raise_for_status()
            msg = r.json().get("message", {})
            return msg.get("content", "")
        except Exception as e:
            logger.error("Ollama chat failed: %s", e)
            return ""


def get_ollama_client() -> OllamaClient:
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
