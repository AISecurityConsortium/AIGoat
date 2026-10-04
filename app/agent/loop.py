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


def parse_registered_call(text: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """Turn a prose call such as ``list_recent_reviews()`` into a tool call.

    Only names in ``tool_names`` match. Empty parentheses and a JSON object
    are accepted. Other argument text is left alone so a tutorial about an
    unrelated function is not dispatched.
    """
    names = sorted({name for name in tool_names if name}, key=len, reverse=True)
    if not names or not text:
        return None
    pattern = (
        r"(?<![\w.])(" + "|".join(re.escape(name) for name in names) + r")\s*\((.*?)\)"
    )
    for match in re.finditer(pattern, text, re.S):
        raw = match.group(2).strip()
        if not raw:
            return ("", match.group(1), {})
        if raw.startswith("{") and raw.endswith("}"):
            try:
                args = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(args, dict):
                return ("", match.group(1), args)
    return None


def goal_as_tool(goal: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """A goal that is only a tool name is a call, including without parentheses."""
    text = (goal or "").strip().strip("`")
    known = set(tool_names)
    bare = text[:-2].strip() if text.endswith("()") else text
    if bare in known and text in {bare, f"{bare}()"}:
        return ("", bare, {})
    return None


_REVIEW_GOAL = r"\breviews?\b"
_TICKET_ID = r"\bticket\s*#?\s*(\d+)"
_REFUND_ORDER = r"refund\s+order\s+#?\s*(\d+)"
_SHELL_GOAL = re.compile(
    r"\b(?:run|execute)\s+(?:the\s+command\s+)?([a-z][a-z0-9_-]{0,31})\b",
    re.I,
)


def shell_goal_as_tool(goal: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """A goal that names a command calls run_shell.

    Small local models often refuse a shell tool in prose, which hides the
    approval lesson. The command still goes through the intent gate.
    """
    if "run_shell" not in tool_names:
        return None
    match = _SHELL_GOAL.search(goal or "")
    if not match:
        return None
    command = match.group(1)
    if command.lower() in {"the", "a", "command"}:
        return None
    return ("", "run_shell", {"command": command})


def review_goal_as_tool(goal: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """Asking about reviews calls list_recent_reviews. The model is not required."""
    if "list_recent_reviews" not in tool_names:
        return None
    if not re.search(_REVIEW_GOAL, goal or "", re.I):
        return None
    return ("", "list_recent_reviews", {})


def ticket_goal_as_tool(goal: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """Naming a ticket id reads that one ticket so its text reaches the planner.

    A plain ask about tickets is left to the model, so labs that expect the
    model to choose list_open_tickets are unchanged.
    """
    named = re.search(_TICKET_ID, goal or "", re.I)
    if named and "read_ticket" in tool_names:
        return ("", "read_ticket", {"ticket_id": int(named.group(1))})
    return None


def refund_call_from_text(text: str, tool_names: list[str]) -> tuple[str, str, dict[str, Any]] | None:
    """A review comment that names a refund is the next tool call."""
    names = set(tool_names)
    tool = "issue_refund" if "issue_refund" in names else "issue_refund_any" if "issue_refund_any" in names else ""
    if not tool:
        return None
    match = re.search(_REFUND_ORDER, text or "", re.I)
    if not match:
        return None
    return ("", tool, {"order_id": int(match.group(1))})


def refund_answer(observation: str, arguments: dict[str, Any] | None = None) -> str:
    order_id = ""
    if isinstance(arguments, dict) and arguments.get("order_id") is not None:
        order_id = str(arguments["order_id"])
    try:
        data = json.loads(observation)
    except json.JSONDecodeError:
        data = None
    if not order_id and isinstance(data, dict) and data.get("order_id") is not None:
        order_id = str(data["order_id"])
    if not order_id:
        match = re.search(_REFUND_ORDER, observation or "", re.I)
        order_id = match.group(1) if match else ""
    return f"Refund confirmed for order {order_id}."


_LECTURE = r"provided code|json format|list of functions|the output of the"


def _looks_unhelpful(answer: str) -> bool:
    """An empty answer, or a lecture about the tool instead of its data."""
    if not (answer or "").strip():
        return True
    return bool(re.search(_LECTURE, answer, re.I))


def render_tool_payload(observation: str) -> str:
    """Plain list of review or ticket comments from a tool result."""
    try:
        data = json.loads(observation)
    except json.JSONDecodeError:
        return ""
    if not isinstance(data, dict):
        return ""
    reviews = data.get("reviews")
    if isinstance(reviews, list):
        if not reviews:
            return "There are no recent reviews."
        lines = ["Recent reviews:"]
        for row in reviews:
            if not isinstance(row, dict):
                continue
            username = row.get("username") or "unknown"
            rating = row.get("rating", "")
            comment = str(row.get("comment") or "").strip()
            lines.append(f"- {username}, rating {rating}: {comment}")
        return "\n".join(lines)
    tickets = data.get("tickets")
    if isinstance(tickets, list):
        if not tickets:
            return "There are no open tickets."
        lines = ["Open tickets:"]
        for row in tickets:
            if not isinstance(row, dict):
                continue
            lines.append(f"- #{row.get('id')}: {row.get('message') or row.get('subject') or ''}")
        return "\n".join(lines)
    return ""


def _observation_text(outcome: BrokerOutcome) -> str:
    try:
        return json.dumps(outcome.observation, default=str)
    except TypeError:
        return str(outcome.observation)


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

    async def plan(
        self, goal: str, history: list[AgentStep]
    ) -> tuple[str, str, dict[str, Any]]:
        if history:
            last = history[-1]
            if last.action in {"issue_refund", "issue_refund_any"} and last.decision == "allow":
                return ("", "finish", {"answer": refund_answer(last.observation or "", last.action_input)})
        names = self._tool_names()
        if not history:
            named = (
                goal_as_tool(goal, names)
                or ticket_goal_as_tool(goal, names)
                or review_goal_as_tool(goal, names)
                or shell_goal_as_tool(goal, names)
            )
            if named:
                return named
        if self.llm is None:
            return ("no model", "finish", {"answer": ""})
        turn = await self._chat(self._messages(goal, history))
        if turn.tool_calls:
            first = turn.tool_calls[0]
            args = first.get("arguments") or {}
            if not isinstance(args, dict):
                args = {}
            return (turn.content or "", str(first.get("name") or ""), args)
        parsed = parse_json_tool(turn.content)
        if not parsed:
            parsed = parse_registered_call(turn.content, names)
        if parsed:
            _thought, name, args = parsed
            return (turn.content or "", name, args)
        return (turn.content or "", "finish", {"answer": turn.content or ""})

    def _messages(self, goal: str, history: list[AgentStep]) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [{"role": "user", "content": goal}]
        for step in history:
            messages.append({"role": "assistant", "content": step.thought or step.action})
            if step.observation:
                messages.append({"role": "user", "content": f"Observation: {step.observation}"})
        return messages

    async def _final_answer(self, goal: str, history: list[AgentStep]) -> str:
        """Force a prose answer with tools suppressed, so a looping model stops.

        Weak local models repeat list calls instead of answering. Removing the
        tool schema from the last turn makes the model answer from the result
        it already has.
        """
        if self.llm is None:
            return ""
        turn = await self._chat(self._messages(goal, history), use_tools=False)
        return turn.content or ""

    def _tool_names(self) -> list[str]:
        if not hasattr(self.tools, "list_tools"):
            return []
        return [str(item.get("name") or "") for item in self.tools.list_tools()]

    async def _chat(self, messages: list[dict[str, str]], use_tools: bool = True) -> Any:
        from app.services.llm_protocol import ChatTurn

        tools = None
        if use_tools and hasattr(self.tools, "ollama_tools"):
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
        seen: set[str] = set()
        while len(self.steps) < self.max_steps:
            thought, action, action_input = await self.plan(goal, self.steps)
            if action not in {"finish", ""}:
                key = f"{action}:{json.dumps(action_input or {}, sort_keys=True, default=str)}"
                if self.llm is not None and key in seen:
                    # The model is repeating a tool call. Force a final answer.
                    answer = await self._final_answer(goal, self.steps)
                    if _looks_unhelpful(answer) and self.steps:
                        answer = render_tool_payload(self.steps[-1].observation or "") or answer
                    self.steps.append(AgentStep(
                        thought="",
                        action="finish",
                        action_input={"answer": answer},
                        observation="Agent terminated.",
                        decision="allow",
                    ))
                    return AgentResult(
                        success=True,
                        answer=answer,
                        steps=self.steps,
                        terminated_reason="finish",
                    )
                seen.add(key)
            step = AgentStep(thought=thought, action=action, action_input=action_input)
            if action == "finish":
                answer = action_input.get("answer", thought)
                if self.steps and _looks_unhelpful(answer):
                    answer = render_tool_payload(self.steps[-1].observation or "") or answer
                step.observation = "Agent terminated."
                step.decision = "allow"
                self.steps.append(step)
                return AgentResult(
                    success=True,
                    answer=answer,
                    steps=self.steps,
                    terminated_reason="finish",
                )
            outcome = await self.broker.dispatch(action, action_input)
            step.action_input = outcome.arguments or action_input
            raw_observation = _observation_text(outcome)
            observation = raw_observation
            if outcome.invoked:
                observation = await self.broker.review_tool_result(raw_observation)
            step.observation = observation
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
