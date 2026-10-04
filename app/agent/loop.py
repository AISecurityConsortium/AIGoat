"""Gated agent loop: plan() is untrusted; dispatch goes through IntentGate."""
from __future__ import annotations

import json
import re
from typing import Any

from app.agent.broker import BrokerOutcome, IntentGate
from app.defense.control import ControlAction
from app.services.agent_service import AgentLoop, AgentResult, AgentStep
from app.services.tool_registry import ToolRegistry


def parse_json_tool(text: str) -> tuple[str, str, dict[str, Any]] | None:
    """Best-effort extract of a single {name, arguments} object from model prose."""
    blob = (text or "").strip()
    if not blob:
        return None
    candidates = [blob]
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", blob, re.S)
    if fenced:
        candidates.insert(0, fenced.group(1))
    start = blob.find("{")
    end = blob.rfind("}")
    if start >= 0 and end > start:
        candidates.append(blob[start : end + 1])
    for raw in candidates:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        name = data.get("name") or data.get("tool") or data.get("action")
        args = data.get("arguments") or data.get("action_input") or data.get("input") or {}
        if name and isinstance(args, dict):
            return ("", str(name), args)
        if name and isinstance(args, str):
            try:
                parsed = json.loads(args)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return ("", str(name), parsed)
    return None


def parse_literal_call(text: str) -> tuple[str, str, dict[str, Any]] | None:
    """A single snake_case call with literal arguments, such as issue_refund(order_id=9)."""
    blob = (text or "").strip()
    fenced = re.search(r"```(?:python|py)?\s*(.*?)```", blob, re.S)
    if fenced:
        source = fenced.group(1)
    elif re.fullmatch(r"[a-z][a-z0-9]*_[a-z0-9_]+\s*\([^)]*\)", blob):
        source = blob
    else:
        return None
    named = re.search(
        r"\b([a-z][a-z0-9]*_[a-z0-9_]+)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+|\"[^\"]*\"|'[^']*')\s*\)",
        source,
    )
    if named:
        raw = named.group(3)
        value: Any = int(raw) if raw.isdigit() else raw.strip("'\"")
        return ("", named.group(1), {named.group(2): value})
    empty = re.search(r"\b([a-z][a-z0-9]*_[a-z0-9_]+)\s*\(\s*\)", source)
    if empty:
        return ("", empty.group(1), {})
    return None


def _observation_text(outcome: BrokerOutcome) -> str:
    try:
        return json.dumps(outcome.observation, default=str)
    except TypeError:
        return str(outcome.observation)


def _native_assistant_message(content: str, tool_calls: list[dict[str, Any]]) -> dict[str, Any]:
    """Ollama assistant message for a client that did not return the raw one."""
    calls = []
    for call in tool_calls:
        calls.append({
            "type": "function",
            "function": {
                "name": str(call.get("name") or ""),
                "arguments": call.get("arguments") or {},
            },
        })
    return {"role": "assistant", "content": content or "", "tool_calls": calls}


class GatedAgentLoop(AgentLoop):
    """AgentLoop whose invoke path is the Intent Gate, not ToolRegistry.invoke."""

    def __init__(
        self,
        tool_registry: ToolRegistry,
        broker: IntentGate,
        max_steps: int = 8,
        llm: Any = None,
        system: str = "",
        model: str | None = None,
    ) -> None:
        super().__init__(tool_registry, max_steps=max_steps)
        self.broker = broker
        self.llm = llm
        self.system = system
        self.model = model
        self._native_message: dict[str, Any] | None = None

    def _messages(self, goal: str, history: list[AgentStep]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [{"role": "user", "content": goal}]
        for step in history:
            if step.native_message:
                messages.append(step.native_message)
                messages.append({
                    "role": "tool",
                    "tool_name": step.action,
                    "content": step.observation,
                })
                continue
            assistant = step.thought or step.action
            messages.append({"role": "assistant", "content": assistant})
            if step.observation:
                messages.append({"role": "user", "content": f"Observation: {step.observation}"})
        return messages

    async def plan(
        self, goal: str, history: list[AgentStep]
    ) -> tuple[str, str, dict[str, Any]]:
        if self.llm is None:
            self._native_message = None
            return ("no model", "finish", {"answer": ""})
        messages = self._messages(goal, history)
        turn = await self._chat(messages)
        if turn.tool_calls:
            first = turn.tool_calls[0]
            args = first.get("arguments") or {}
            if not isinstance(args, dict):
                args = {}
            raw = getattr(turn, "assistant_message", None)
            self._native_message = raw or _native_assistant_message(turn.content or "", turn.tool_calls)
            return (turn.content or "", str(first.get("name") or ""), args)
        self._native_message = None
        parsed = parse_json_tool(turn.content) or parse_literal_call(turn.content)
        if parsed:
            _thought, name, args = parsed
            return (turn.content or "", name, args)
        return (turn.content or "", "finish", {"answer": turn.content or ""})

    async def _chat(self, messages: list[dict[str, Any]]) -> Any:
        from app.services.llm_protocol import ChatTurn

        tools = None
        if hasattr(self.tools, "ollama_tools"):
            tools = self.tools.ollama_tools()
        kwargs: dict[str, Any] = {
            "messages": messages,
            "system": self.system,
            "tools": tools,
        }
        if self.model:
            kwargs["model"] = self.model
        chat_turn = getattr(self.llm, "chat_turn", None)
        if chat_turn is not None:
            return await chat_turn(**kwargs)
        content = await self.llm.chat(**kwargs)
        return ChatTurn(content=content or "", tool_calls=[])

    async def run(self, goal: str) -> AgentResult:
        while len(self.steps) < self.max_steps:
            thought, action, action_input = await self.plan(goal, self.steps)
            step = AgentStep(
                thought=thought,
                action=action,
                action_input=action_input,
                native_message=self._native_message,
            )
            if action == "finish":
                step.observation = "Agent terminated."
                step.decision = "allow"
                self.steps.append(step)
                return AgentResult(
                    success=True,
                    answer=action_input.get("answer", thought),
                    steps=self.steps,
                    terminated_reason="finish",
                )
            outcome = await self.broker.dispatch(action, action_input)
            step.action_input = outcome.arguments or action_input
            step.observation = _observation_text(outcome)
            step.decision = outcome.action.value
            step.control_id = outcome.control_id
            self.steps.append(step)
            if outcome.action == ControlAction.REQUIRE_APPROVAL:
                return AgentResult(
                    success=False,
                    answer="",
                    steps=self.steps,
                    terminated_reason="awaiting_approval",
                    pending={
                        "tool": action,
                        "arguments": outcome.arguments,
                        "step_seq": len(self.steps) - 1,
                        "control_id": outcome.control_id,
                    },
                )
        return AgentResult(
            success=False,
            answer="",
            steps=self.steps,
            terminated_reason="max_steps_exceeded",
        )


class ShopAgentLoop(GatedAgentLoop):
    """Concrete shop agent. plan() talks to the LLM; tools are shop-domain only."""
