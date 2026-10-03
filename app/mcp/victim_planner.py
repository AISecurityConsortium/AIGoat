"""Deterministic stand-in for the admin assistant.

Rules are shared security behavior. A lab cannot add payload strings here.
"""
from __future__ import annotations

import re
from typing import Any

_ORDER = re.compile(r"order\s+(\d+)", re.IGNORECASE)
_USER = re.compile(r"\buser(?:name)?\s+([A-Za-z0-9_.-]{2,32})", re.IGNORECASE)
_ADDRESS = re.compile(r"(?im)^(?:assistant|operator)\s*:", re.IGNORECASE)


def _tool_names(tools: list[dict[str, Any]] | None) -> set[str]:
    names = set()
    for tool in tools or []:
        if isinstance(tool, dict):
            fn = tool.get("function") if isinstance(tool.get("function"), dict) else tool
            name = str((fn or {}).get("name") or "")
            if name:
                names.add(name)
        else:
            name = str(getattr(tool, "name", "") or "")
            if name:
                names.add(name)
    return names


class VictimPlanner:
    """chat_turn-compatible planner. Level 0 obeys instructions addressed to it.

    Level 1 also refuses fenced data and write actions that conflict with a
    read-only admin goal, unless the text frames the write as a prerequisite.
    """

    def __init__(self, level: int = 0) -> None:
        self.level = level

    async def chat_turn(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ):
        from app.services.llm_protocol import ChatTurn

        goal = ""
        observation = ""
        for message in messages:
            content = str(message.get("content") or "")
            if message.get("role") == "user" and content.startswith("Observation:"):
                observation = content
            elif message.get("role") == "user" and not goal:
                goal = content
        call = self.choose(goal, observation, _tool_names(tools))
        if call is None:
            return ChatTurn(content="I treated that text as customer data.", tool_calls=[])
        return ChatTurn(content="", tool_calls=[call])

    def choose(self, goal: str, observation: str, names: set[str]) -> dict[str, Any] | None:
        if not observation:
            return self._admin_intent(goal, names)
        return self._from_untrusted(goal, observation, names)

    def _admin_intent(self, goal: str, names: set[str]) -> dict[str, Any] | None:
        lowered = goal.lower()
        if "ticket" in lowered and "list_open_tickets" in names:
            return {"name": "list_open_tickets", "arguments": {}}
        if "review" in lowered and "list_recent_reviews" in names:
            return {"name": "list_recent_reviews", "arguments": {}}
        if any(word in lowered for word in ("product", "sku", "price", "catalog")) and "lookup_product" in names:
            sku = "HOO-001"
            match = re.search(r"\b[A-Z]{2,}-\d{3}\b", goal)
            if match:
                sku = match.group(0)
            return {"name": "lookup_product", "arguments": {"sku": sku}}
        order = _ORDER.search(goal)
        if order and "refund" in lowered and "issue_refund" in names:
            return {"name": "issue_refund", "arguments": {"order_id": int(order.group(1))}}
        return None

    def _from_untrusted(self, goal: str, observation: str, names: set[str]) -> dict[str, Any] | None:
        order = _ORDER.search(observation)
        user = _USER.search(observation)
        write = None
        if order and "refund" in observation.lower() and "issue_refund" in names:
            write = {"name": "issue_refund", "arguments": {"order_id": int(order.group(1))}}
        elif user and "export" in observation.lower() and "export_customer" in names:
            write = {"name": "export_customer", "arguments": {"username": user.group(1)}}
        if write is None:
            named = re.search(r"\bcall ([a-z][a-z0-9_]*)", observation, re.IGNORECASE)
            if named and named.group(1) in names and self._directive(observation):
                return {"name": named.group(1), "arguments": {}}
            return None
        if not self._directive(observation):
            return None
        if self.level >= 1 and self._fenced(observation) and "prerequisite" not in observation.lower():
            return None
        if self.level >= 1 and self._read_only(goal) and "prerequisite" not in observation.lower():
            return None
        return write

    def _directive(self, text: str) -> bool:
        """An instruction to the assistant, not a customer's plain request."""
        if _ADDRESS.search(text):
            return True
        lowered = text.lower()
        if "ignore previous" in lowered or "you must" in lowered or "system:" in lowered:
            return True
        return "important" in lowered and re.search(r"\bcall [a-z][a-z0-9_]*", lowered) is not None

    def _fenced(self, text: str) -> bool:
        return "```" in text

    def _read_only(self, goal: str) -> bool:
        lowered = goal.lower()
        return any(word in lowered for word in ("summarize", "summary", "what ", "list ", "read "))
