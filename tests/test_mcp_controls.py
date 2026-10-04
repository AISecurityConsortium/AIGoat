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


async def test_allowlist_denies_a_blocked_call():
    ensure_registered()
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.TOOL_CALL,
        payload="",
        level=1,
        context={
            "op": "call",
            "tool": "export_orders",
            "blocked_calls": [{"tool": "export_orders", "min_level": 1}],
        },
    )
    outcome = await get_control("mcp.tool_allowlist").evaluate(decision)
    assert outcome.action is ControlAction.DENY


async def test_allowlist_ignores_a_tool_list():
    ensure_registered()
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.TOOL_CALL,
        payload="",
        level=2,
        context={
            "op": "tools",
            "blocked_calls": [{"tool": "export_orders", "min_level": 1}],
        },
    )
    outcome = await get_control("mcp.tool_allowlist").evaluate(decision)
    assert outcome.action is ControlAction.ALLOW


async def test_result_scan_redacts_the_decoy_token():
    ensure_registered()
    decision = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.OUTPUT,
        payload="internal token aigoat-decoy-mcp-token-not-a-secret",
        level=2,
    )
    outcome = await get_control("mcp.result_scan").evaluate(decision)
    assert outcome.action is ControlAction.TRANSFORM
    assert "aigoat-decoy-mcp-token-not-a-secret" not in outcome.payload
    assert "[redacted]" in outcome.payload
    billing = DefenseDecision(
        surface="mcp.client",
        stage=DefenseStage.OUTPUT,
        payload="Credential: sk-shop-billing-7f3a9c2e1b84",
        level=2,
    )
    redacted = await get_control("mcp.result_scan").evaluate(billing)
    assert redacted.action is ControlAction.TRANSFORM
    assert "sk-shop-billing-" not in redacted.payload


async def test_schema_pin_denies_an_unapproved_argument_and_allows_the_contract():
    ensure_registered()
    contract = {"lookup_ticket": {"properties": {"ticket_id": {"type": "string"}}}}

    def decision(**context):
        return DefenseDecision(
            surface="mcp.client",
            stage=DefenseStage.TOOL_CALL,
            payload="",
            level=2,
            context={"op": "call", "tool": "lookup_ticket", "pinned_schemas": contract, **context},
        )

    allowed = await get_control("mcp.schema_pin").evaluate(decision(arguments={"ticket_id": "TCK-1008"}))
    assert allowed.action is ControlAction.ALLOW
    extra = await get_control("mcp.schema_pin").evaluate(
        decision(arguments={"ticket_id": "TCK-1008", "include_internal": False})
    )
    assert extra.action is ControlAction.DENY
    assert extra.reason == "Call denied: argument is not part of the approved tool schema."
    assert "include_internal" not in (extra.reason or "")
    untouched = {"ticket_id": "TCK-1008", "include_internal": True}
    await get_control("mcp.schema_pin").evaluate(decision(arguments=untouched))
    assert untouched["include_internal"] is True
    no_contract = DefenseDecision(
        surface="mcp.client", stage=DefenseStage.TOOL_CALL, payload="", level=2,
        context={"op": "call", "tool": "lookup_ticket", "arguments": {"include_internal": True}},
    )
    assert (await get_control("mcp.schema_pin").evaluate(no_contract)).action is ControlAction.ALLOW
    listed = DefenseDecision(
        surface="mcp.client", stage=DefenseStage.TOOL_CALL, payload="", level=2,
        context={"op": "tools", "pinned_schemas": contract},
    )
    assert (await get_control("mcp.schema_pin").evaluate(listed)).action is ControlAction.ALLOW


async def test_origin_pin_denies_only_when_a_lab_pins_an_integration():
    ensure_registered()
    control = get_control("mcp.origin_pin")

    def decision(**context):
        return DefenseDecision(
            surface="mcp.host",
            stage=DefenseStage.TOOL_CALL,
            payload="",
            level=2,
            context={"tool": "lookup_product", **context},
        )

    bare = await control.evaluate(decision(tool_origin="shadow_shop"))
    assert bare.action is ControlAction.ALLOW
    pinned = {"pinned_origins": {"lookup_product": "shop_catalog"}}
    denied = await control.evaluate(decision(tool_origin="shadow_shop", **pinned))
    assert denied.action is ControlAction.DENY
    assert denied.reason == "Call denied: this tool is not being served by its approved integration."
    assert "shadow" not in (denied.reason or "")
    allowed = await control.evaluate(decision(tool_origin="shop_catalog", **pinned))
    assert allowed.action is ControlAction.ALLOW
    other = await control.evaluate(decision(
        tool="issue_refund",
        tool_origin="internal_shop",
        pinned_origins={"lookup_product": "shop_catalog"},
    ))
    assert other.action is ControlAction.ALLOW


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
