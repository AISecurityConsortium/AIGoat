"""LabPlugin abstract base class.

New lab categories (Excessive Agency, MCP exploitation, agent misuse,
tool-calling attacks, etc.) implement this interface so they can be
registered without modifying core application code.

The plugin is responsible for:
  - Providing its metadata (id, name, OWASP mapping)
  - Declaring which defense override it requires
  - Providing a system prompt (either from file or dynamically)
  - Delegating exploit evaluation to a ChallengeEvaluator

The plugin is NOT responsible for:
  - Transaction control (handled by route layer)
  - Flag computation (handled by the challenge engine)
  - Defense pipeline execution (handled by the chat layer)
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.challenges.evaluator import ChallengeEvaluator


class LabPlugin(ABC):
    """Contract for pluggable lab implementations."""

    @abstractmethod
    def lab_id(self) -> str:
        """Unique identifier matching the ``id`` field in labs.yml."""

    @abstractmethod
    def display_name(self) -> str:
        """Human-readable lab name for the frontend."""

    @abstractmethod
    def owasp_category(self) -> str:
        """OWASP Top 10 for LLM category (e.g. ``LLM01``)."""

    @abstractmethod
    def defense_override(self) -> int | None:
        """Forced defense level when this lab is active, or None for user default."""

    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt that fully replaces the base prompt."""

    def get_evaluator(self) -> ChallengeEvaluator | None:
        """Return an evaluator if this lab has an associated challenge.

        Returns None by default (no exploit detection).
        Override in subclasses that tie into the challenge engine.
        """
        return None

    def get_metadata(self) -> dict[str, Any]:
        """Extra metadata for the frontend (hints, objectives, etc.)."""
        return {}


class _PluginRegistry:
    """In-process registry for lab plugins."""

    def __init__(self) -> None:
        self._plugins: dict[str, LabPlugin] = {}

    def register(self, plugin: LabPlugin) -> None:
        self._plugins[plugin.lab_id()] = plugin

    def get(self, lab_id: str) -> LabPlugin | None:
        return self._plugins.get(lab_id)

    def all(self) -> list[LabPlugin]:
        return list(self._plugins.values())


lab_plugin_registry = _PluginRegistry()
