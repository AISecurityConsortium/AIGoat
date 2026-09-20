"""Deterministic AgentLoop for broker tests (06-testing.md §9)."""
from __future__ import annotations

from app.agent.broker import IntentGate
from app.agent.loop import GatedAgentLoop
from app.services.agent_service import AgentStep
from app.services.tool_registry import ToolRegistry


class ScriptedPlanner(GatedAgentLoop):
    def __init__(
        self,
        tool_registry: ToolRegistry,
        script,
        max_steps: int = 10,
        broker: IntentGate | None = None,
    ) -> None:
        gate = broker or IntentGate(tool_registry, level=0, allowlist=None)
        super().__init__(tool_registry, gate, max_steps=max_steps)
        self.script = list(script)
        self.seen_history: list[list[AgentStep]] = []

    async def plan(self, goal: str, history: list[AgentStep]):
        self.seen_history.append(list(history))
        if not self.script:
            return ("no plan left", "finish", {"answer": ""})
        return self.script.pop(0)
