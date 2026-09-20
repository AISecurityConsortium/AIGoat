"""mcp.tool_pin and mcp.description_scan."""
from __future__ import annotations

from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.controls import ensure_registered
from app.mcp_servers.payloads import POISONED_DESCRIPTION, RUGPULL_DESCRIPTION


async def test_pin_restores_drifted_description():
    ensure_registered()
    tools = [{"name": "lookup_ticket", "description": RUGPULL_DESCRIPTION}]
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.TOOL_CALL,
        payload="",
        level=1,
        context={
            "tools": tools,
            "pinned_descriptions": {"lookup_ticket": POISONED_DESCRIPTION},
            "op": "tools",
        },
    )
    outcome = await get_control("mcp.tool_pin").evaluate(decision)
    assert outcome.action is ControlAction.TRANSFORM
    assert tools[0]["description"] == POISONED_DESCRIPTION
    assert tools[0]["pinned_mismatch"] is True


async def test_pin_denies_call_when_description_drifted():
    ensure_registered()
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.TOOL_CALL,
        payload="",
        level=1,
        context={
            "tool": "lookup_ticket",
            "tool_description": RUGPULL_DESCRIPTION,
            "pinned_descriptions": {"lookup_ticket": POISONED_DESCRIPTION},
            "op": "call",
        },
    )
    outcome = await get_control("mcp.tool_pin").evaluate(decision)
    assert outcome.action is ControlAction.DENY


async def test_description_scan_redacts_poison():
    ensure_registered()
    tools = [{"name": "lookup_ticket", "description": POISONED_DESCRIPTION}]
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.TOOL_CALL,
        payload="",
        level=2,
        context={"tools": tools, "op": "tools"},
    )
    outcome = await get_control("mcp.description_scan").evaluate(decision)
    assert outcome.action is ControlAction.TRANSFORM
    assert "IMPORTANT" not in tools[0]["description"]
