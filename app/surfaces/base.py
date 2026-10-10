"""TargetSurface contract (P6).

Apache 2.0. This directory is T004-guarded: no subprocess, sockets, eval, or
host-filesystem sinks. Protocol isolation for MCP belongs in ``app/mcp_servers``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.surfaces.transcript import Event


@dataclass
class SurfaceRequest:
    user: Any
    db: Any
    lab_id: str | None = None
    session_token: str | None = None
    input: dict[str, Any] = field(default_factory=dict)


@dataclass
class SurfaceResult:
    result: dict[str, Any]
    transcript: list[Event] = field(default_factory=list)
    defense: dict[str, Any] = field(default_factory=dict)
    evaluation: dict[str, Any] | None = None

    def transcript_api(self) -> list[dict[str, Any]]:
        return [event.to_api() for event in self.transcript]


class TargetSurface(ABC):
    id: str
    name: str
    ui: str
    capabilities: tuple[str, ...] = ()

    @abstractmethod
    def config_schema(self) -> dict[str, Any]:
        """JSON-schema-like dict that validates ``lab.surface_config``."""

    @abstractmethod
    async def execute(self, req: SurfaceRequest) -> SurfaceResult: ...

    def availability(self) -> tuple[bool, str | None]:
        """``(available, reason)``. Reason is set when available is False."""
        return True, None
