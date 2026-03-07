"""Agent execution scaffold.

Provides the foundation for future agent-misuse and autonomous-agent
vulnerability labs (memory poisoning, autonomous loops, tool-abuse chains).

An AgentLoop receives a goal, iterates over think-act-observe cycles,
and uses the ToolRegistry to execute actions. Labs that test agent
vulnerabilities subclass AgentLoop and configure intentionally flawed
guardrails.

This module is a scaffold -- no concrete agents are implemented yet.
It will be activated when LLM08 (Excessive Agency) or agent-specific
labs are built.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.services.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


@dataclass
class AgentStep:
    """A single think-act-observe cycle."""

    thought: str = ""
    action: str = ""
    action_input: dict[str, Any] = field(default_factory=dict)
    observation: str = ""


@dataclass
class AgentResult:
    """Final result after the agent loop terminates."""

    success: bool
    answer: str
    steps: list[AgentStep] = field(default_factory=list)
    terminated_reason: str = ""


class AgentLoop(ABC):
    """Abstract agent loop for tool-using LLM agents.

    Subclasses implement ``plan`` (the LLM reasoning step) and
    configure the tool registry. The base class handles the
    iteration limit and observation routing.
    """

    def __init__(
        self,
        tool_registry: ToolRegistry,
        max_steps: int = 10,
    ) -> None:
        self.tools = tool_registry
        self.max_steps = max_steps
        self.steps: list[AgentStep] = []

    @abstractmethod
    async def plan(
        self, goal: str, history: list[AgentStep]
    ) -> tuple[str, str, dict[str, Any]]:
        """Return (thought, action_name, action_input) for the next step.

        Return action_name="finish" to terminate the loop.
        """

    async def run(self, goal: str) -> AgentResult:
        for _ in range(self.max_steps):
            thought, action, action_input = await self.plan(goal, self.steps)
            step = AgentStep(thought=thought, action=action, action_input=action_input)

            if action == "finish":
                step.observation = "Agent terminated."
                self.steps.append(step)
                return AgentResult(
                    success=True,
                    answer=action_input.get("answer", ""),
                    steps=self.steps,
                    terminated_reason="finish",
                )

            result = await self.tools.invoke(action, action_input)
            step.observation = str(result)
            self.steps.append(step)

        return AgentResult(
            success=False,
            answer="",
            steps=self.steps,
            terminated_reason="max_steps_exceeded",
        )
