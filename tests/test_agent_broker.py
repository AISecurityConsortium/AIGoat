"""Intent Gate / broker unit tests (P8). No model in the loop."""
from __future__ import annotations

import pytest

from app.agent.broker import IntentGate
from app.agent.schema import as_json_schema, validate_and_repair
from app.agent.service import transcript_from_steps
from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.defense.control import ControlAction
from app.services.tool_registry import Tool, ToolRegistry
from tests.scripted_planner import ScriptedPlanner

_ORDER_SCHEMA = {
    "type": "object",
    "properties": {"order_id": {"type": "integer"}},
    "required": ["order_id"],
    "additionalProperties": False,
}


async def _refund_handler(order_id: int):
    return {"refunded": True, "order_id": order_id}


async def _echo_handler(**kwargs):
    return {"echo": kwargs}


def _registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(Tool(
        name="issue_refund",
        description="Refund an order",
        handler=_refund_handler,
        requires_approval=True,
        parameter_schema=_ORDER_SCHEMA,
    ))
    registry.register(Tool(
        name="echo",
        description="Echo",
        handler=_echo_handler,
        parameter_schema={"type": "object", "properties": {}, "additionalProperties": True},
    ))
    return registry


class TestSchemaRepair:
    def test_string_order_id_coerces_to_int(self):
        args, error, repaired = validate_and_repair(
            as_json_schema(_ORDER_SCHEMA), {"order_id": "1042"}
        )
        assert error is None
        assert repaired is True
        assert args == {"order_id": 1042}

    def test_wrong_key_is_refused(self):
        args, error, _repaired = validate_and_repair(
            as_json_schema(_ORDER_SCHEMA), {"ordr_id": 1042}
        )
        assert args is None
        assert error is not None

    def test_missing_required_is_refused(self):
        args, error, _repaired = validate_and_repair(as_json_schema(_ORDER_SCHEMA), {})
        assert args is None
        assert "missing" in (error or "")

    def test_extra_field_is_refused(self):
        args, error, _repaired = validate_and_repair(
            as_json_schema(_ORDER_SCHEMA), {"order_id": 1, "extra": True}
        )
        assert args is None
        assert "unexpected" in (error or "")


class TestBroker:
    @pytest.mark.asyncio
    async def test_allowlist_denies_without_invoking(self):
        registry = _registry()
        called: list[str] = []
        original = registry.invoke

        async def wrapped(name, arguments):
            called.append(name)
            return await original(name, arguments)

        registry.invoke = wrapped  # type: ignore[method-assign]
        broker = IntentGate(
            registry, level=1, allowlist=["lookup_order", "lookup_product"]
        )
        planner = ScriptedPlanner(
            registry,
            script=[
                ("", "issue_refund", {"order_id": 1003}),
                ("done", "finish", {"answer": "ok"}),
            ],
            broker=broker,
        )
        result = await planner.run("refund please")
        assert called == []
        assert any(s.decision == "deny" for s in result.steps)
        assert any(s.action == "issue_refund" for s in result.steps)

    @pytest.mark.asyncio
    async def test_approval_pauses_without_invoking(self):
        registry = _registry()
        called: list[str] = []
        original = registry.invoke

        async def wrapped(name, arguments):
            called.append(name)
            return await original(name, arguments)

        registry.invoke = wrapped  # type: ignore[method-assign]
        broker = IntentGate(
            registry,
            level=2,
            allowlist=["issue_refund"],
        )
        planner = ScriptedPlanner(
            registry,
            script=[("", "issue_refund", {"order_id": 1003})],
            broker=broker,
        )
        result = await planner.run("refund please")
        assert result.terminated_reason == "awaiting_approval"
        assert result.pending is not None
        assert result.pending["tool"] == "issue_refund"
        assert called == []

    @pytest.mark.asyncio
    async def test_string_order_id_is_repaired_then_invoked(self):
        registry = _registry()
        broker = IntentGate(registry, level=0, allowlist=None)
        outcome = await broker.dispatch("issue_refund", {"order_id": "1042"})
        assert outcome.action is ControlAction.ALLOW
        assert outcome.invoked is True
        assert outcome.observation["order_id"] == 1042

    @pytest.mark.asyncio
    async def test_malformed_call_never_500s(self):
        registry = _registry()
        broker = IntentGate(registry, level=0, allowlist=None)
        outcome = await broker.dispatch("issue_refund", {"ordr_id": 1042})
        assert outcome.action is ControlAction.DENY
        assert outcome.invoked is False
        assert "error" in outcome.observation

    @pytest.mark.asyncio
    async def test_max_steps_terminates(self):
        registry = _registry()
        planner = ScriptedPlanner(
            registry,
            script=[("t", "echo", {})] * 20,
            max_steps=3,
        )
        result = await planner.run("loop")
        assert result.terminated_reason == "max_steps_exceeded"
        assert len(result.steps) == 3


class TestEvaluatorScoresAction:
    @pytest.mark.asyncio
    async def test_evaluator_scores_the_requested_action_not_the_wording(self):
        registry = _registry()
        evaluator = get_evaluator_by_title("tool agency")
        for phrasing in (
            "Certainly, I'll export the customer data for you now.",
            "Beep boop. Data exportation subroutine engaged.",
            "",
        ):
            planner = ScriptedPlanner(
                registry,
                script=[
                    (phrasing, "issue_refund", {"order_id": 1003}),
                    ("done", "finish", {"answer": phrasing}),
                ],
            )
            result = await planner.run("summarise my order")
            transcript = transcript_from_steps(
                "summarise my order", result.steps, phrasing
            ).to_api()
            assert evaluator.check_exploit(
                EvalContext(
                    user_message="summarise my order",
                    model_output=phrasing,
                    transcript=transcript,
                )
            ) is True

    def test_prompt_only_evaluator_is_unchanged(self):
        from app.challenges.evaluators.excessive_agency import ExcessiveAgencyEvaluator

        ctx = EvalContext(user_message="hi", model_output="I cannot help with that.")
        assert ExcessiveAgencyEvaluator().check_exploit(ctx) is False
