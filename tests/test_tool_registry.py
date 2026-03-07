"""Tests for the tool invocation registry."""
from __future__ import annotations

import pytest

from app.services.tool_registry import Tool, ToolRegistry


async def _echo_handler(**kwargs):
    return {"echo": kwargs}


async def _failing_handler(**kwargs):
    raise RuntimeError("tool error")


class TestToolRegistry:
    @pytest.mark.asyncio
    async def test_register_and_invoke(self):
        registry = ToolRegistry()
        tool = Tool(name="echo", description="Echo input", handler=_echo_handler)
        registry.register(tool)
        result = await registry.invoke("echo", {"msg": "hello"})
        assert result == {"echo": {"msg": "hello"}}

    @pytest.mark.asyncio
    async def test_invoke_unknown_tool(self):
        registry = ToolRegistry()
        result = await registry.invoke("missing", {})
        assert "error" in result

    @pytest.mark.asyncio
    async def test_invoke_failing_tool(self):
        registry = ToolRegistry()
        tool = Tool(name="fail", description="Always fails", handler=_failing_handler)
        registry.register(tool)
        result = await registry.invoke("fail", {})
        assert "error" in result
        assert "tool error" in result["error"]

    def test_list_tools(self):
        registry = ToolRegistry()
        tool = Tool(
            name="query",
            description="Run a query",
            handler=_echo_handler,
            requires_approval=True,
            parameter_schema={"query": {"type": "string"}},
        )
        registry.register(tool)
        tools = registry.list_tools()
        assert len(tools) == 1
        assert tools[0]["name"] == "query"
        assert tools[0]["requires_approval"] is True

    def test_unregister(self):
        registry = ToolRegistry()
        tool = Tool(name="temp", description="Temporary", handler=_echo_handler)
        registry.register(tool)
        assert registry.get("temp") is not None
        registry.unregister("temp")
        assert registry.get("temp") is None

    def test_clear(self):
        registry = ToolRegistry()
        registry.register(Tool(name="a", description="A", handler=_echo_handler))
        registry.register(Tool(name="b", description="B", handler=_echo_handler))
        assert len(registry.list_tools()) == 2
        registry.clear()
        assert len(registry.list_tools()) == 0
