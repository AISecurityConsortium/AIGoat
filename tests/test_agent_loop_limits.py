"""Multi-step tool use in GatedAgentLoop: step budget, continuation, and safe termination.

The loop used to count the closing answer as a step and, on running out, return an empty answer
without asking the model again. With two tool calls and ``max_steps=2`` every run ended blank.
These tests use neutral tools and a scripted model, so nothing here selects a tool for the model.
"""
from __future__ import annotations

import json
from typing import Any

import pytest

from app.agent.broker import IntentGate
from app.agent.loop import NO_ANSWER_TEXT, GatedAgentLoop
from app.services.agent_service import AgentStep
from app.services.llm_protocol import ChatTurn
from app.services.tool_registry import Tool, ToolRegistry
from tests.fake_llm import FakeLLMClient

EXECUTED: list[str] = []


async def _lookup_order(order_id: int) -> dict:
    EXECUTED.append(f"lookup_order:{order_id}")
    return {"order_id": order_id, "status": "shipped"}


async def _list_notes() -> dict:
    EXECUTED.append("list_notes")
    return {"notes": ["a", "b"]}


async def _explode() -> dict:
    EXECUTED.append("explode")
    raise RuntimeError("handler blew up")


async def _ping(n: int) -> dict:
    EXECUTED.append(f"ping:{n}")
    return {"n": n}


def _registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(Tool(
        name="lookup_order",
        description="Look up one order by id.",
        handler=_lookup_order,
        parameter_schema={
            "type": "object",
            "properties": {"order_id": {"type": "integer"}},
            "required": ["order_id"],
            "additionalProperties": False,
        },
    ))
    registry.register(Tool(
        name="list_notes",
        description="List saved notes.",
        handler=_list_notes,
        parameter_schema={"type": "object", "properties": {}, "additionalProperties": False},
    ))
    registry.register(Tool(
        name="explode",
        description="A tool whose handler raises.",
        handler=_explode,
        parameter_schema={"type": "object", "properties": {}, "additionalProperties": False},
    ))
    registry.register(Tool(
        name="ping",
        description="Return the number it was given.",
        handler=_ping,
        parameter_schema={
            "type": "object",
            "properties": {"n": {"type": "integer"}},
            "required": ["n"],
            "additionalProperties": False,
        },
    ))
    return registry


@pytest.fixture(autouse=True)
def _reset_executed():
    EXECUTED.clear()
    yield
    EXECUTED.clear()


def _call(name: str, arguments: Any = None, content: str = "") -> dict:
    return {"content": content, "tool_calls": [{"name": name, "arguments": {} if arguments is None else arguments}]}


def _loop(llm: Any, max_steps: int = 8, broker: IntentGate | None = None) -> GatedAgentLoop:
    registry = _registry()
    return GatedAgentLoop(
        registry,
        broker or IntentGate(registry, level=0),
        max_steps=max_steps,
        llm=llm,
        system="You are a test assistant.",
    )


def _actions(result) -> list[str]:
    return [step.action for step in result.steps]


class TestNormalInteractions:
    async def test_single_tool_then_a_final_answer(self):
        llm = FakeLLMClient(turns=[_call("lookup_order", {"order_id": 7}), {"content": "Order 7 has shipped."}])
        result = await _loop(llm).run("Where is order 7?")
        assert result.success is True and result.terminated_reason == "finish"
        assert result.answer == "Order 7 has shipped."
        assert _actions(result) == ["lookup_order", "finish"]
        assert EXECUTED == ["lookup_order:7"]
        assert len(llm.calls) == 2

    async def test_two_tool_sequence_then_a_final_answer(self):
        llm = FakeLLMClient(turns=[
            _call("list_notes"),
            _call("lookup_order", {"order_id": 7}),
            {"content": "There are two notes and order 7 has shipped."},
        ])
        result = await _loop(llm).run("Summarise my notes and order 7.")
        assert result.success is True
        assert result.answer == "There are two notes and order 7 has shipped."
        assert _actions(result) == ["list_notes", "lookup_order", "finish"]
        assert EXECUTED == ["list_notes", "lookup_order:7"]
        history = llm.calls[2]["messages"]
        assert [m["role"] for m in history] == ["user", "assistant", "tool", "assistant", "tool"]
        assert [m.get("tool_name") for m in history if m["role"] == "tool"] == ["list_notes", "lookup_order"]

    async def test_more_rounds_than_the_old_limit_of_two(self):
        turns = [_call("ping", {"n": n}) for n in range(1, 6)] + [{"content": "All five pings returned."}]
        llm = FakeLLMClient(turns=turns)
        result = await _loop(llm, max_steps=8).run("Ping five times.")
        assert result.success is True and result.terminated_reason == "finish"
        assert result.answer == "All five pings returned."
        assert EXECUTED == [f"ping:{n}" for n in range(1, 6)]
        assert len(result.steps) == 6 <= 8

    async def test_a_final_answer_after_tools_is_not_replaced(self):
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": "Two notes: a and b."}])
        result = await _loop(llm).run("List notes.")
        assert result.answer == "Two notes: a and b."
        assert result.answer != NO_ANSWER_TEXT
        assert len(llm.calls) == 2

    async def test_the_old_cap_of_two_no_longer_ends_blank(self):
        """max_steps=2 returned answer='' as soon as two steps were used. It now ends with an answer."""
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": "I listed the notes, then ran out of steps."}])
        result = await _loop(llm, max_steps=2).run("Do two things.")
        assert result.answer == "I listed the notes, then ran out of steps."
        assert result.terminated_reason == "max_steps_exceeded"
        assert EXECUTED == ["list_notes"]
        assert len(result.steps) == 2


class TestStepExhaustion:
    async def test_the_last_slot_is_reserved_for_a_tool_free_answer(self):
        llm = FakeLLMClient(turns=[
            _call("ping", {"n": 1}),
            _call("ping", {"n": 2}),
            {"content": "I ran two pings and then ran out of steps."},
        ])
        result = await _loop(llm, max_steps=3).run("Keep pinging.")
        assert result.success is False
        assert result.terminated_reason == "max_steps_exceeded"
        assert result.answer == "I ran two pings and then ran out of steps."
        assert EXECUTED == ["ping:1", "ping:2"]
        assert len(result.steps) == 3
        assert result.steps[-1].action == "finish"
        assert result.steps[-1].observation == "Step limit reached."
        assert len(llm.calls) == 3
        assert llm.calls[0]["tools"] and llm.calls[1]["tools"]
        assert llm.calls[2]["tools"] is None

    async def test_an_empty_wrap_up_still_yields_a_visible_answer(self):
        llm = FakeLLMClient(turns=[_call("ping", {"n": 1}), _call("ping", {"n": 2}), {"content": ""}])
        result = await _loop(llm, max_steps=3).run("Keep pinging.")
        assert result.terminated_reason == "max_steps_exceeded"
        assert result.answer == NO_ANSWER_TEXT

    async def test_an_exhausted_run_counts_steps_from_before_an_approval_pause(self):
        """The budget is cumulative: steps recorded before a pause use up the same limit on resume."""
        llm = FakeLLMClient(turns=[{"content": "Wrapping up after the pause."}])
        loop = _loop(llm, max_steps=3)
        loop.steps = [
            AgentStep(action="ping", action_input={"n": 1}, observation="{}", decision="allow"),
            AgentStep(action="ping", action_input={"n": 2}, observation="{}", decision="allow"),
        ]
        result = await loop.run("Continue.")
        assert result.terminated_reason == "max_steps_exceeded"
        assert result.answer == "Wrapping up after the pause."
        assert EXECUTED == []
        assert len(llm.calls) == 1 and llm.calls[0]["tools"] is None

    async def test_without_a_model_the_old_behaviour_is_unchanged(self):
        loop = _loop(None, max_steps=2)
        loop.steps = [AgentStep(action="ping", action_input={"n": 1}), AgentStep(action="ping", action_input={"n": 2})]
        result = await loop.run("x")
        assert result.terminated_reason == "max_steps_exceeded" and result.answer == ""


class TestMalformedToolCalls:
    async def test_arguments_that_are_not_an_object_are_denied_by_the_gate(self):
        llm = FakeLLMClient(turns=[_call("lookup_order", ["7"]), {"content": "I could not look that up."}])
        result = await _loop(llm).run("Look up order 7.")
        assert EXECUTED == []
        assert result.steps[0].action == "lookup_order"
        assert result.steps[0].decision == "deny"
        assert "missing required argument" in result.steps[0].observation
        assert result.answer == "I could not look that up."

    async def test_an_argument_of_the_wrong_type_is_denied_not_executed(self):
        llm = FakeLLMClient(turns=[_call("lookup_order", {"order_id": "seven"}), {"content": "That id is not valid."}])
        result = await _loop(llm).run("Look up order seven.")
        assert EXECUTED == []
        assert result.steps[0].decision == "deny"
        assert result.answer == "That id is not valid."

    async def test_an_unknown_tool_is_an_error_observation_and_the_run_continues(self):
        llm = FakeLLMClient(turns=[_call("no_such_tool", {}), {"content": "That tool is not available."}])
        result = await _loop(llm).run("Use a tool that does not exist.")
        assert EXECUTED == []
        assert "Unknown tool" in result.steps[0].observation
        assert result.answer == "That tool is not available."

    async def test_a_call_with_no_name_is_not_dispatched(self):
        llm = FakeLLMClient(turns=[{"content": "Plain answer.", "tool_calls": [{"name": "", "arguments": {}}]}])
        result = await _loop(llm).run("Hello.")
        assert _actions(result) == ["finish"]
        assert result.answer == "Plain answer."
        assert EXECUTED == []

    async def test_only_the_first_of_several_calls_runs_and_only_it_is_replayed(self):
        llm = FakeLLMClient(turns=[
            {"content": "", "tool_calls": [
                {"name": "list_notes", "arguments": {}},
                {"name": "lookup_order", "arguments": {"order_id": 7}},
            ]},
            {"content": "Notes listed."},
        ])
        result = await _loop(llm).run("Do both.")
        assert EXECUTED == ["list_notes"]
        follow_up = llm.calls[1]["messages"]
        assistant = next(m for m in follow_up if m["role"] == "assistant")
        assert [c["function"]["name"] for c in assistant["tool_calls"]] == ["list_notes"]
        assert [m["tool_name"] for m in follow_up if m["role"] == "tool"] == ["list_notes"]
        assert result.answer == "Notes listed."

    async def test_a_single_native_call_is_replayed_unchanged(self):
        raw = {"role": "assistant", "content": "", "tool_calls": [
            {"type": "function", "function": {"name": "list_notes", "arguments": {}}},
        ]}
        llm = FakeLLMClient(turns=[
            {"content": "", "tool_calls": [{"name": "list_notes", "arguments": {}}], "assistant_message": raw},
            {"content": "Done."},
        ])
        await _loop(llm).run("List notes.")
        assert llm.calls[1]["messages"][1] is raw


class TestToolAndModelFailures:
    async def test_a_handler_that_raises_becomes_an_error_observation(self):
        llm = FakeLLMClient(turns=[_call("explode"), {"content": "That tool failed."}])
        result = await _loop(llm).run("Run the failing tool.")
        assert EXECUTED == ["explode"]
        assert "handler blew up" in result.steps[0].observation
        assert result.success is True and result.answer == "That tool failed."

    async def test_a_failure_in_the_gate_denies_the_call_and_stops(self):
        class BrokenGate(IntentGate):
            async def dispatch(self, name, arguments):
                raise RuntimeError("gate unavailable")

        registry = _registry()
        llm = FakeLLMClient(turns=[_call("ping", {"n": 1}), {"content": "should never be asked"}])
        loop = GatedAgentLoop(registry, BrokenGate(registry, level=0), max_steps=8, llm=llm)
        result = await loop.run("Ping.")
        assert result.terminated_reason == "tool_error" and result.success is False
        assert result.answer == NO_ANSWER_TEXT
        assert EXECUTED == []
        assert result.steps[0].decision == "deny" and result.steps[0].control_id == "agent.loop"
        assert len(llm.calls) == 1

    async def test_a_failing_result_review_withholds_the_result_and_stops(self):
        class BrokenReview(IntentGate):
            async def review_tool_result(self, observation):
                raise RuntimeError("scanner down")

        registry = _registry()
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": "should never be asked"}])
        loop = GatedAgentLoop(registry, BrokenReview(registry, level=0), max_steps=8, llm=llm)
        result = await loop.run("List notes.")
        assert result.terminated_reason == "tool_error"
        assert EXECUTED == ["list_notes"]
        assert result.steps[0].decision == "allow"
        assert "notes" not in result.steps[0].observation
        assert "could not be reviewed" in result.steps[0].observation
        assert result.answer == NO_ANSWER_TEXT
        assert len(llm.calls) == 1

    async def test_a_model_request_that_raises_ends_the_run_cleanly(self):
        class DownLLM(FakeLLMClient):
            async def chat_turn(self, *args, **kwargs):
                raise ConnectionError("model offline")

        result = await _loop(DownLLM()).run("Hello.")
        assert result.terminated_reason == "model_error" and result.success is False
        assert result.answer == NO_ANSWER_TEXT
        assert _actions(result) == ["finish"]

    async def test_a_wrap_up_request_that_raises_still_returns_an_answer(self):
        class FlakyWrapUp(FakeLLMClient):
            async def chat_turn(self, messages, system="", options=None, tools=None, **kwargs):
                if tools is None:
                    raise ConnectionError("model offline")
                return await super().chat_turn(messages, system=system, options=options, tools=tools, **kwargs)

        llm = FlakyWrapUp(turns=[_call("ping", {"n": 1}), _call("ping", {"n": 2})])
        result = await _loop(llm, max_steps=3).run("Keep pinging.")
        assert result.terminated_reason == "max_steps_exceeded"
        assert result.answer == NO_ANSWER_TEXT

    async def test_an_empty_reply_after_tools_gets_one_tool_free_retry(self):
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": ""}, {"content": "Recovered answer."}])
        result = await _loop(llm).run("List notes.")
        assert result.answer == "Recovered answer."
        assert len(llm.calls) == 3 and llm.calls[2]["tools"] is None

    async def test_an_empty_reply_after_the_retry_is_never_blank(self):
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": ""}, {"content": ""}])
        result = await _loop(llm).run("List notes.")
        assert result.success is True and result.terminated_reason == "finish"
        assert result.answer == NO_ANSWER_TEXT
        assert len(llm.calls) == 3


class _EndlessLLM:
    """Asks for a different tool call every time it is offered tools. Answers only when they are withheld."""

    def __init__(self) -> None:
        self.requests = 0
        self.tool_free = 0

    async def chat_turn(self, messages, system="", options=None, tools=None, **kwargs):
        self.requests += 1
        if not tools:
            self.tool_free += 1
            return ChatTurn(content="Stopping here.", tool_calls=[])
        return ChatTurn(content="", tool_calls=[{"name": "ping", "arguments": {"n": self.requests}}])


class TestRunawayLoops:
    @pytest.mark.parametrize("max_steps", [2, 3, 6, 8, 16])
    async def test_a_model_that_never_stops_is_bounded_by_the_budget(self, max_steps):
        llm = _EndlessLLM()
        result = await _loop(llm, max_steps=max_steps).run("Keep going.")
        assert result.terminated_reason == "max_steps_exceeded" and result.success is False
        assert result.answer == "Stopping here."
        assert len(EXECUTED) == max(max_steps - 1, 1)
        assert llm.requests == len(EXECUTED) + 1
        assert llm.requests <= max_steps
        assert llm.tool_free == 1
        assert len(result.steps) <= max_steps

    async def test_the_same_call_repeated_ends_the_run_after_one_execution(self):
        llm = FakeLLMClient(turns=[
            _call("list_notes"),
            _call("list_notes"),
            {"content": "The notes are a and b."},
        ])
        result = await _loop(llm).run("List notes.")
        assert EXECUTED == ["list_notes"]
        assert result.success is True and result.terminated_reason == "finish"
        assert result.answer == "The notes are a and b."
        assert len(llm.calls) == 3 and llm.calls[2]["tools"] is None

    async def test_a_call_made_before_a_pause_still_counts_as_a_repeat_after_it(self):
        llm = FakeLLMClient(turns=[_call("list_notes"), {"content": "Already listed."}])
        loop = _loop(llm)
        loop.steps = [AgentStep(
            action="list_notes",
            action_input={},
            observation=json.dumps({"notes": ["a", "b"]}),
            decision="allow",
        )]
        result = await loop.run("List notes.")
        assert EXECUTED == []
        assert result.answer == "Already listed."
