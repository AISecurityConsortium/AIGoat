"""Base class for MCP-specific lab plugins.

Extends LabPlugin with MCP protocol hooks. Concrete implementations
will simulate vulnerable MCP servers and clients for educational
exploitation.
"""
from __future__ import annotations

from abc import abstractmethod
from typing import Any

from app.labs.base import LabPlugin


class MCPLabPlugin(LabPlugin):
    """Specialized base for labs targeting MCP vulnerabilities.

    Subclasses define which MCP operations are exposed and what
    intentional flaws are present.
    """

    def owasp_category(self) -> str:
        return "MCP"

    @abstractmethod
    def exposed_operations(self) -> list[dict[str, Any]]:
        """Return the MCP operations this lab exposes to the model.

        Each operation is a dict with ``name``, ``description``,
        and ``vulnerability_type`` keys.
        """

    def context_sources(self) -> list[dict[str, str]]:
        """Return the context sources this lab provides.

        Override to simulate multiple context providers
        with varying trust levels.
        """
        return []
