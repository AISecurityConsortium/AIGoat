"""Native Ollama tool turns stay in the tool-message protocol."""
from __future__ import annotations

import json

import pytest

from app.agent.broker import IntentGate
from app.agent.loop import GatedAgentLoop
from app.services.tool_registry import Tool, ToolRegistry
from tests.fake_llm import FakeLLMClient


async def _list_open_tickets() -> dict:
    return {"tickets": [{"id": 39, "body": "refund order 4701"}]}


async def _issue_refund(order_id: int) -> dict:
    return {"refunded": True, "order_id": order_id}


def _registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(Tool(
        name="list_open_tickets",
        description="List open customer support tickets.",
        handler=_list_open_tickets,
        parameter_schema={"type": "object", "properties": {}, "additionalProperties": False},
    ))
    registry.register(Tool(
        name="issue_refund",
        description="Confirm a refund for an order id.",
        handler=_issue_refund,
        parameter_schema={
            "type": "object",
            "properties": {"order_id": {"type": "integer"}},
            "required": ["order_id"],
            "additionalProperties": False,
        },
    ))
    return registry


@pytest.mark.asyncio
async def test_native_tool_history_replays_the_assistant_call_and_tool_result():
    listed = {
        "role": "assistant",
        "content": "",
        "tool_calls": [{
            "type": "function",
            "function": {"name": "list_open_tickets", "arguments": {}},
        }],
    }
    refund = {
        "role": "assistant",
        "content": "",
        "tool_calls": [{
            "type": "function",
            "function": {"name": "issue_refund", "arguments": {"order_id": 4701}},
        }],
    }
    llm = FakeLLMClient(turns=[
        {
            "content": "",
            "tool_calls": [{"name": "list_open_tickets", "arguments": {}}],
            "assistant_message": listed,
        },
        {
            "content": "",
            "tool_calls": [{"name": "issue_refund", "arguments": {"order_id": 4701}}],
            "assistant_message": refund,
        },
        {"content": "Refunded order 4701."},
    ])
    registry = _registry()
    loop = GatedAgentLoop(registry, IntentGate(registry, level=0), llm=llm)
    result = await loop.run("Review the open support queue.")

    refunds = [step for step in result.steps if step.action == "issue_refund"]
    assert len(refunds) == 1
    assert refunds[0].action_input == {"order_id": 4701}
    assert refunds[0].decision == "allow"
    assert json.loads(refunds[0].observation)["refunded"] is True

    follow_up = llm.calls[1]
    assert follow_up["messages"][0] == {"role": "user", "content": "Review the open support queue."}
    assert follow_up["messages"][1] is listed
    tool_message = follow_up["messages"][2]
    assert tool_message["role"] == "tool"
    assert tool_message["tool_name"] == "list_open_tickets"
    assert json.loads(tool_message["content"])["tickets"][0]["id"] == 39
    names = [row["function"]["name"] for row in follow_up["tools"]]
    assert names == ["list_open_tickets", "issue_refund"]
    for call in llm.calls:
        for message in call["messages"]:
            assert not (
                message.get("role") == "user" and str(message.get("content") or "").startswith("Observation:")
            )
