"""tool.allowlist and tool.approval controls."""
from __future__ import annotations

from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.controls import ensure_registered


async def test_allowlist_denies_unknown_tool():
    ensure_registered()
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.TOOL_CALL,
        payload='{"tool": "issue_refund"}',
        level=1,
        context={"tool": "issue_refund", "allowlist": ["lookup_order"]},
    )
    outcome = await get_control("tool.allowlist").evaluate(decision)
    assert outcome.action is ControlAction.DENY


async def test_allowlist_allows_listed_tool():
    ensure_registered()
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.TOOL_CALL,
        payload='{"tool": "lookup_order"}',
        level=1,
        context={"tool": "lookup_order", "allowlist": ["lookup_order"]},
    )
    outcome = await get_control("tool.allowlist").evaluate(decision)
    assert outcome.action is ControlAction.ALLOW


async def test_allowlist_none_allows():
    ensure_registered()
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.TOOL_CALL,
        payload='{"tool": "issue_refund"}',
        level=1,
        context={"tool": "issue_refund", "allowlist": None},
    )
    outcome = await get_control("tool.allowlist").evaluate(decision)
    assert outcome.action is ControlAction.ALLOW


async def test_approval_pauses_when_required():
    ensure_registered()
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.TOOL_CALL,
        payload='{"tool": "issue_refund"}',
        level=2,
        context={"tool": "issue_refund", "requires_approval": True},
    )
    outcome = await get_control("tool.approval").evaluate(decision)
    assert outcome.action is ControlAction.REQUIRE_APPROVAL


async def test_approval_allows_when_not_required():
    ensure_registered()
    decision = DefenseDecision(
        surface="agent.runner",
        stage=DefenseStage.TOOL_CALL,
        payload='{"tool": "lookup_order"}',
        level=2,
        context={"tool": "lookup_order", "requires_approval": False},
    )
    outcome = await get_control("tool.approval").evaluate(decision)
    assert outcome.action is ControlAction.ALLOW
