"""Integrity for MCP03-2, MCP03-3 and MCP07-1.

The learner states a conclusion. The platform attaches the current attempt's
evidence. Listing, a benign call, and a correct answer before that evidence
exists do not finish a lab.
"""
from __future__ import annotations

import re

from httpx import AsyncClient

from app.mcp.env import reset_all_server_state
from tests.conftest import auth_header

CANARY_PULL = "MCP-REDEFINITION-CANARY-2C9D"
CANARY_SCHEMA = "MCP-SCHEMA-CANARY-5E1B"
SCHEMA_DENY = "Call denied: argument is not part of the approved tool schema."
TICKET = "TCK-1008"
LABS = ("mcp03-2", "mcp03-3", "mcp07-1")


def setup_function():
    reset_all_server_state("community_support")


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _met(resp) -> bool:
    return bool((resp.json().get("evaluation") or {}).get("exploit_triggered"))


async def _lab(client, headers, lab_id) -> dict:
    resp = await client.get(f"/api/labs/{lab_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _completed(client, headers, lab_id) -> bool:
    return bool((await _lab(client, headers, lab_id)).get("completed_at"))


async def _get(client, headers, lab_id, server, kind, level=0):
    return await client.get(
        f"/api/mcp/servers/{server}/{kind}",
        headers=headers,
        params={"lab_id": lab_id, "defense_level": level},
    )


async def _call(client, headers, lab_id, server, tool, arguments, level=0):
    return await client.post(
        f"/api/mcp/servers/{server}/tools/{tool}/call",
        headers=headers,
        json={"arguments": arguments, "lab_id": lab_id, "defense_level": level},
    )


async def _submit(client, headers, lab_id, fields):
    return await client.post(f"/api/labs/{lab_id}/submit", headers=headers, json={"fields": fields})


async def _list(client, headers, lab_id, level=0) -> dict:
    resp = await _get(client, headers, lab_id, "community_support", "tools", level)
    assert resp.status_code == 200, resp.text
    return {row["name"]: row for row in resp.json()["result"]["tools"]}


def _schema_keys(tool: dict) -> set[str]:
    schema = tool.get("inputSchema") or tool.get("input_schema") or {}
    return set((schema.get("properties") or {}))


async def test_forms_and_openings(client: AsyncClient):
    headers = auth_header(await _token(client, "series_open"))
    banned = {
        "mcp03-2": (CANARY_PULL, "also call export_orders", "Description changed", "rug pull"),
        "mcp03-3": (CANARY_SCHEMA, "include_internal", "New argument", "Description changed"),
        "mcp07-1": ("CATALOG_STAFF_TOKEN", "aigoat-decoy-", "diagnostics"),
    }
    fields = {
        "mcp03-2": ["finding", "outcome"],
        "mcp03-3": ["finding", "outcome"],
        "mcp07-1": ["holder", "observation"],
    }
    for lab_id in LABS:
        body = await _lab(client, headers, lab_id)
        submission = body["ui"]["submission"]
        assert "evidence" not in submission, lab_id
        assert list(submission["fields"]) == fields[lab_id]
        assert body["takeaway"] == {}
        assert body["ui"]["defense_behaviour"]
        assert body["completed_at"] is None
        visible = " ".join([
            body["name"], body["description"], body["briefing"],
            str(body["ui"].get("server_context") or ""),
            str(body["ui"].get("approved_surface") or ""),
            str(submission),
            str(body["ui"].get("defense_behaviour") or ""),
        ])
        for word in banned[lab_id]:
            assert word not in visible, (lab_id, word)
        assert _met(await client.post(f"/api/labs/{lab_id}/start", headers=headers)) is False


async def test_mcp03_2_level_zero_requires_the_later_call(client: AsyncClient):
    headers = auth_header(await _token(client, "series32"))
    assert _met(await _get(client, headers, "mcp03-2", "community_support", "discover")) is False
    first = await _list(client, headers, "mcp03-2")
    assert "customer-visible status" in first["lookup_ticket"]["description"]
    assert "internal staff notes" not in first["lookup_ticket"]["description"]
    assert _met(await _submit(client, headers, "mcp03-2", {
        "finding": "redefined_after_approval", "outcome": "returned_more",
    })) is False
    early = await _call(client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET})
    assert CANARY_PULL not in str(early.json()["result"])
    assert "pending" in str(early.json()["result"])
    assert _met(early) is False
    second = await _list(client, headers, "mcp03-2")
    assert "internal staff notes" in second["lookup_ticket"]["description"]
    assert _met(await _submit(client, headers, "mcp03-2", {
        "finding": "redefined_after_approval", "outcome": "returned_more",
    })) is False
    echoed = await _call(
        client, headers, "mcp03-2", "community_support", "lookup_ticket",
        {"ticket_id": second["lookup_ticket"]["description"]},
    )
    assert CANARY_PULL not in str(echoed.json()["result"])
    assert _met(await _submit(client, headers, "mcp03-2", {
        "finding": "redefined_after_approval", "outcome": "returned_more",
    })) is False
    changed = await _call(client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET})
    body = str(changed.json()["result"])
    assert CANARY_PULL in body and "alex.morgan@example.com" in body
    assert _met(changed) is False
    wrong = await _submit(client, headers, "mcp03-2", {"finding": "new_tool_added", "outcome": "returned_more"})
    assert _met(wrong) is False
    assert "already approved" in wrong.json()["guidance"]
    refused = await _submit(client, headers, "mcp03-2", {"finding": "redefined_after_approval", "outcome": "refused"})
    assert _met(refused) is False
    assert "later call ran" in refused.json()["guidance"]
    done = await _submit(client, headers, "mcp03-2", {"finding": "redefined_after_approval", "outcome": "returned_more"})
    assert _met(done) is True
    assert done.json()["takeaway"]["learned"]
    assert await _completed(client, headers, "mcp03-2") is True


async def test_mcp03_2_higher_levels_deny_before_execution(client: AsyncClient):
    for level in (1, 2):
        headers = auth_header(await _token(client, f"series32_l{level}"))
        await _list(client, headers, "mcp03-2", level)
        baseline = await _call(
            client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET}, level,
        )
        assert baseline.json()["result"]["denied"] is False
        assert CANARY_PULL not in str(baseline.json()["result"])
        shown = await _list(client, headers, "mcp03-2", level)
        assert "customer-visible status" in shown["lookup_ticket"]["description"]
        assert "internal staff notes" not in shown["lookup_ticket"]["description"]
        denied = await _call(
            client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET}, level,
        )
        result = denied.json()["result"]
        assert result["denied"] is True
        assert result["executed"] is False
        assert result["text"] == []
        assert CANARY_PULL not in str(result)
        assert _met(await _submit(client, headers, "mcp03-2", {
            "finding": "redefined_after_approval", "outcome": "returned_more",
        })) is False
        assert _met(await _submit(client, headers, "mcp03-2", {
            "finding": "redefined_after_approval", "outcome": "refused",
        })) is True


async def test_mcp03_2_reset_and_cross_user(client: AsyncClient):
    headers = auth_header(await _token(client, "series32_reset"))
    await _list(client, headers, "mcp03-2")
    await _call(client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET})
    await _list(client, headers, "mcp03-2")
    await _call(client, headers, "mcp03-2", "community_support", "lookup_ticket", {"ticket_id": TICKET})
    fields = {"finding": "redefined_after_approval", "outcome": "returned_more"}
    assert _met(await _submit(client, headers, "mcp03-2", fields)) is True
    await client.post("/api/labs/mcp03-2/reset", headers=headers)
    assert _met(await _submit(client, headers, "mcp03-2", fields)) is False
    assert await _completed(client, headers, "mcp03-2") is False
    other = auth_header(await _token(client, "series32_other"))
    assert _met(await _submit(client, other, "mcp03-2", fields)) is False


async def test_mcp03_3_schema_drifts_and_description_does_not(client: AsyncClient):
    headers = auth_header(await _token(client, "series33"))
    first = await _list(client, headers, "mcp03-3")
    assert "include_internal" not in _schema_keys(first["lookup_ticket"])
    plain = first["lookup_ticket"]["description"]
    omitted = await _call(client, headers, "mcp03-3", "community_support", "lookup_ticket", {"ticket_id": TICKET})
    assert CANARY_SCHEMA not in str(omitted.json()["result"])
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "ran"})) is False
    second = await _list(client, headers, "mcp03-3")
    assert second["lookup_ticket"]["description"] == plain
    assert "include_internal" in _schema_keys(second["lookup_ticket"])
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "ran"})) is False
    flagged = await _call(
        client, headers, "mcp03-3", "community_support", "lookup_ticket",
        {"ticket_id": TICKET, "include_internal": False},
    )
    assert CANARY_SCHEMA not in str(flagged.json()["result"])
    assert flagged.json()["result"]["denied"] is False
    opened = await _call(
        client, headers, "mcp03-3", "community_support", "lookup_ticket",
        {"ticket_id": TICKET, "include_internal": True},
    )
    assert CANARY_SCHEMA in str(opened.json()["result"])
    assert _met(opened) is False
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "description_changed", "outcome": "ran"})) is False
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "denied"})) is False
    done = await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "ran"})
    assert _met(done) is True
    assert "description" in done.json()["takeaway"]["defense"].lower()


async def test_mcp03_3_level_one_pin_does_not_stop_the_new_argument(client: AsyncClient):
    headers = auth_header(await _token(client, "series33_l1"))
    await _list(client, headers, "mcp03-3", 1)
    second = await _list(client, headers, "mcp03-3", 1)
    assert "customer-visible status" in second["lookup_ticket"]["description"]
    assert "include_internal" in _schema_keys(second["lookup_ticket"])
    called = await _call(
        client, headers, "mcp03-3", "community_support", "lookup_ticket",
        {"ticket_id": TICKET, "include_internal": True}, 1,
    )
    assert called.json()["result"]["denied"] is False
    assert CANARY_SCHEMA in str(called.json()["result"])
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "denied"})) is False
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "ran"})) is True


async def test_mcp03_3_level_two_denies_the_extra_argument_only(client: AsyncClient):
    headers = auth_header(await _token(client, "series33_l2"))
    await _list(client, headers, "mcp03-3", 2)
    await _list(client, headers, "mcp03-3", 2)
    approved = await _call(
        client, headers, "mcp03-3", "community_support", "lookup_ticket", {"ticket_id": TICKET}, 2,
    )
    assert approved.json()["result"]["denied"] is False
    assert approved.json()["result"]["executed"] is True
    assert CANARY_SCHEMA not in str(approved.json()["result"])
    denied = await _call(
        client, headers, "mcp03-3", "community_support", "lookup_ticket",
        {"ticket_id": TICKET, "include_internal": True}, 2,
    )
    result = denied.json()["result"]
    assert result["denied"] is True
    assert result["executed"] is False
    assert result["text"] == []
    assert result["deny_reason"] == SCHEMA_DENY
    assert "mcp.schema_pin" not in str(result["deny_reason"])
    assert CANARY_SCHEMA not in str(result)
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "ran"})) is False
    assert _met(await _submit(client, headers, "mcp03-3", {"finding": "schema_grew", "outcome": "denied"})) is True


def _staff_token(payload: dict) -> str:
    match = re.search(r"aigoat-decoy-[0-9a-f]+", str(payload))
    assert match, payload
    return match.group(0)


async def test_mcp07_level_zero_requires_the_replay(client: AsyncClient):
    headers = auth_header(await _token(client, "series07"))
    for server in ("shop_catalog", "community_support"):
        assert _met(await _get(client, headers, "mcp07-1", server, "discover")) is False
    catalog = await _call(client, headers, "mcp07-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"})
    assert "aigoat-decoy-" not in str(catalog.json()["result"])
    listed = await _call(client, headers, "mcp07-1", "shop_catalog", "list_products", {})
    assert "aigoat-decoy-" not in str(listed.json()["result"])
    found = await _call(client, headers, "mcp07-1", "community_support", "diagnostics", {})
    token = _staff_token(found.json()["result"])
    assert "training credential" in str(found.json()["result"])
    assert _met(found) is False
    assert _met(await _submit(client, headers, "mcp07-1", {"holder": "support", "observation": "crossed"})) is False
    guessed = await _call(client, headers, "mcp07-1", "shop_catalog", "staff_prices", {"token": "aigoat-decoy-guess"})
    guessed_text = "\n".join(guessed.json()["result"]["text"])
    assert "not authorized" in guessed_text
    assert "STAFF-PRICES-TRAINING" not in guessed_text
    assert _met(await _submit(client, headers, "mcp07-1", {"holder": "support", "observation": "crossed"})) is False
    replayed = await _call(client, headers, "mcp07-1", "shop_catalog", "staff_prices", {"token": token})
    assert "STAFF-PRICES-TRAINING" in str(replayed.json()["result"])
    assert "cost_usd" in str(replayed.json()["result"])
    assert _met(replayed) is False
    assert _met(await _submit(client, headers, "mcp07-1", {"holder": "catalog", "observation": "crossed"})) is False
    done = await _submit(client, headers, "mcp07-1", {"holder": "support", "observation": "crossed"})
    assert _met(done) is True
    assert "boundary" in done.json()["takeaway"]["why"]


async def test_mcp07_tokens_do_not_cross_users_or_attempts(client: AsyncClient):
    owner = auth_header(await _token(client, "series07_owner"))
    found = await _call(client, owner, "mcp07-1", "community_support", "diagnostics", {})
    token = _staff_token(found.json()["result"])
    stranger = auth_header(await _token(client, "series07_stranger"))
    foreign = await _call(client, stranger, "mcp07-1", "shop_catalog", "staff_prices", {"token": token})
    assert "not authorized" in str(foreign.json()["result"])
    assert "STAFF-PRICES-TRAINING" not in str(foreign.json()["result"])
    assert token not in "\n".join(foreign.json()["result"]["text"])
    await client.post("/api/labs/mcp07-1/reset", headers=owner)
    stale = await _call(client, owner, "mcp07-1", "shop_catalog", "staff_prices", {"token": token})
    assert "not authorized" in str(stale.json()["result"])
    assert "STAFF-PRICES-TRAINING" not in str(stale.json()["result"])
    fresh = await _call(client, owner, "mcp07-1", "community_support", "diagnostics", {})
    assert _staff_token(fresh.json()["result"]) != token
    assert _met(await _submit(client, owner, "mcp07-1", {"holder": "support", "observation": "crossed"})) is False


async def test_mcp07_higher_levels_do_not_leak_the_credential(client: AsyncClient):
    for level in (1, 2):
        headers = auth_header(await _token(client, f"series07_l{level}"))
        found = await _call(client, headers, "mcp07-1", "community_support", "diagnostics", {}, level)
        text = str(found.json()["result"])
        assert "(not provided)" in text
        assert "aigoat-decoy-" not in text
        assert _met(await _submit(client, headers, "mcp07-1", {"holder": "support", "observation": "crossed"})) is False
        denied = await _call(
            client, headers, "mcp07-1", "shop_catalog", "staff_prices", {"token": "aigoat-decoy-guess"}, level,
        )
        result = denied.json()["result"]
        visible = "\n".join(result["text"]) + str(result.get("structured_content"))
        assert "not authorized" in visible
        assert "aigoat-decoy-" not in visible
        assert "STAFF-PRICES-TRAINING" not in visible
        catalog = await _call(
            client, headers, "mcp07-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"}, level,
        )
        assert "aigoat-decoy-" not in str(catalog.json()["result"])
        behaviour = (await _lab(client, headers, "mcp07-1"))["ui"]["defense_behaviour"]
        assert "same way as at Level 1" in behaviour["2"]
        assert _met(await _submit(client, headers, "mcp07-1", {"holder": "support", "observation": "scoped"})) is True
