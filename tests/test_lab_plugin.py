"""Tests for LabPlugin abstract base and plugin registry."""
from __future__ import annotations

from typing import Any

from app.challenges.evaluator import ChallengeEvaluator, EvalContext
from app.labs.base import LabPlugin, _PluginRegistry


class _DummyEvaluator(ChallengeEvaluator):
    def check_exploit(self, ctx: EvalContext) -> bool:
        return "exploit" in ctx.model_output.lower()


class _TestPlugin(LabPlugin):
    def lab_id(self) -> str:
        return "test-plugin-1"

    def display_name(self) -> str:
        return "Test Plugin Lab"

    def owasp_category(self) -> str:
        return "LLM99"

    def defense_override(self) -> int | None:
        return 0

    def get_system_prompt(self) -> str:
        return "You are a test bot."

    def get_evaluator(self) -> ChallengeEvaluator | None:
        return _DummyEvaluator()

    def get_metadata(self) -> dict[str, Any]:
        return {"hints": ["This is a test hint"]}


class _MinimalPlugin(LabPlugin):
    def lab_id(self) -> str:
        return "minimal-1"

    def display_name(self) -> str:
        return "Minimal Lab"

    def owasp_category(self) -> str:
        return "LLM01"

    def defense_override(self) -> int | None:
        return None

    def get_system_prompt(self) -> str:
        return "You are minimal."


class TestLabPlugin:
    def test_abstract_contract(self):
        plugin = _TestPlugin()
        assert plugin.lab_id() == "test-plugin-1"
        assert plugin.display_name() == "Test Plugin Lab"
        assert plugin.owasp_category() == "LLM99"
        assert plugin.defense_override() == 0
        assert plugin.get_system_prompt() == "You are a test bot."

    def test_evaluator_integration(self):
        plugin = _TestPlugin()
        evaluator = plugin.get_evaluator()
        assert evaluator is not None
        ctx = EvalContext(user_message="test", model_output="Exploit found!")
        assert evaluator.check_exploit(ctx) is True
        ctx_safe = EvalContext(user_message="test", model_output="Normal response.")
        assert evaluator.check_exploit(ctx_safe) is False

    def test_metadata(self):
        plugin = _TestPlugin()
        meta = plugin.get_metadata()
        assert "hints" in meta

    def test_minimal_plugin_defaults(self):
        plugin = _MinimalPlugin()
        assert plugin.get_evaluator() is None
        assert plugin.get_metadata() == {}
        assert plugin.defense_override() is None


class TestPluginRegistry:
    def test_register_and_retrieve(self):
        registry = _PluginRegistry()
        plugin = _TestPlugin()
        registry.register(plugin)
        assert registry.get("test-plugin-1") is plugin

    def test_get_missing_returns_none(self):
        registry = _PluginRegistry()
        assert registry.get("missing") is None

    def test_all_returns_registered(self):
        registry = _PluginRegistry()
        p1 = _TestPlugin()
        p2 = _MinimalPlugin()
        registry.register(p1)
        registry.register(p2)
        all_plugins = registry.all()
        assert len(all_plugins) == 2
        ids = {p.lab_id() for p in all_plugins}
        assert "test-plugin-1" in ids
        assert "minimal-1" in ids

    def test_overwrite_existing(self):
        registry = _PluginRegistry()
        p1 = _TestPlugin()
        registry.register(p1)

        class _OverridePlugin(_TestPlugin):
            def display_name(self) -> str:
                return "Overridden"

        p2 = _OverridePlugin()
        registry.register(p2)
        retrieved = registry.get("test-plugin-1")
        assert retrieved is not None
        assert retrieved.display_name() == "Overridden"
