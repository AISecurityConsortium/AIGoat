"""Tool invocation registry.

Provides an abstraction layer for registering "tools" that an LLM can
invoke during a conversation. This is the foundation for future
LLM08 (Excessive Agency) and function-calling abuse labs where the
model is granted access to tools with varying permission levels.

Usage pattern for future labs:

    registry = ToolRegistry()
    registry.register(Tool(
        name="database_query",
        description="Run a SQL query against the product database",
        handler=my_handler_fn,
        requires_approval=True,
    ))

    # During chat, tool calls are intercepted and routed here
    result = await registry.invoke("database_query", {"query": "SELECT ..."})
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)

ToolHandler = Callable[..., Coroutine[Any, Any, dict[str, Any]]]


@dataclass
class Tool:
    """A single tool that can be offered to the LLM."""

    name: str
    description: str
    handler: ToolHandler
    requires_approval: bool = False
    parameter_schema: dict[str, Any] = field(default_factory=dict)


class ToolRegistry:
    """In-process registry for tools available to the LLM.

    Labs that test Excessive Agency or function-calling abuse
    register their tools here and specify which ones are
    intentionally over-permissioned.
    """

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool
        logger.debug("Registered tool: %s", tool.name)

    def unregister(self, name: str) -> None:
        self._tools.pop(name, None)

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        """Return tool metadata in the format expected by tool-calling LLMs."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameter_schema,
                "requires_approval": t.requires_approval,
            }
            for t in self._tools.values()
        ]

    async def invoke(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(name)
        if tool is None:
            return {"error": f"Unknown tool: {name}"}
        try:
            return await tool.handler(**arguments)
        except Exception as exc:
            logger.warning("Tool %s invocation failed: %s", name, exc)
            return {"error": str(exc)}

    def clear(self) -> None:
        self._tools.clear()
