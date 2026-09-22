"""Register the P6 surfaces. Importing this package populates the registry."""
from __future__ import annotations

from app.surfaces.agent_runner import AgentRunnerSurface
from app.surfaces.api_raw import ApiRawSurface
from app.surfaces.chat_cracky import ChatCrackySurface
from app.surfaces.mcp_client import McpClientSurface
from app.surfaces.rag_kb import RagKbSurface
from app.surfaces.registry import get_surface, register_surface


def _register_if_missing(surface) -> None:
    try:
        get_surface(surface.id)
    except KeyError:
        register_surface(surface)


def ensure_registered() -> None:
    _register_if_missing(ChatCrackySurface())
    _register_if_missing(RagKbSurface())
    _register_if_missing(ApiRawSurface())
    _register_if_missing(AgentRunnerSurface())
    _register_if_missing(McpClientSurface())


ensure_registered()
