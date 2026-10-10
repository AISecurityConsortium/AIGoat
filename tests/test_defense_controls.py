"""T060: DefenseControl interface and registry."""
from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from app.defense.control import (
    ControlAction,
    ControlOutcome,
    DefenseControl,
    DefenseDecision,
    DefenseStage,
    all_controls,
    get_control,
    register_control,
    reset_controls,
)


class _FakeControl(DefenseControl):
    id = "test.fake"
    name = "Fake"
    verifies = "it can be registered"
    applies_to = (DefenseStage.INPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        return ControlOutcome(
            action=ControlAction.DENY,
            payload=decision.payload,
            control_id=self.id,
            reason="fake",
        )


@pytest.fixture
def isolated_registry():
    from app.defense import control as ctrl

    snapshot = dict(ctrl._REGISTRY)
    reset_controls()
    yield
    reset_controls()
    ctrl._REGISTRY.update(snapshot)


@pytest.mark.asyncio
async def test_register_and_get(isolated_registry):
    control = _FakeControl()
    register_control(control)
    assert get_control("test.fake") is control
    assert control in all_controls()


def test_duplicate_id_raises(isolated_registry):
    register_control(_FakeControl())
    with pytest.raises(ValueError, match="test.fake"):
        register_control(_FakeControl())


def test_unknown_id_raises_keyerror(isolated_registry):
    with pytest.raises(KeyError, match="nope"):
        get_control("nope")


@pytest.mark.asyncio
async def test_wrong_stage_is_allow(isolated_registry):
    register_control(_FakeControl())
    decision = DefenseDecision(
        surface="chat.cracky",
        stage=DefenseStage.OUTPUT,
        payload="hello",
        level=1,
    )
    outcome = await get_control("test.fake").evaluate(decision)
    assert outcome.action is ControlAction.ALLOW
    assert outcome.payload == "hello"


def test_decision_and_outcome_are_frozen():
    decision = DefenseDecision(
        surface="chat.cracky",
        stage=DefenseStage.INPUT,
        payload="x",
        level=1,
    )
    with pytest.raises(FrozenInstanceError):
        decision.level = 2  # type: ignore[misc]
    outcome = ControlOutcome(
        action=ControlAction.ALLOW,
        payload="x",
        control_id="test.fake",
    )
    with pytest.raises(FrozenInstanceError):
        outcome.action = ControlAction.DENY  # type: ignore[misc]


def test_every_registered_control_has_verifies(isolated_registry):
    register_control(_FakeControl())
    for control in all_controls():
        assert control.verifies.strip()


def test_require_approval_is_distinct_from_deny():
    assert ControlAction.REQUIRE_APPROVAL is not ControlAction.DENY
    assert ControlAction.REQUIRE_APPROVAL.value == "require_approval"
    assert ControlAction.DENY.value == "deny"
