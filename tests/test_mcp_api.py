"""HTTP tests for /api/mcp and mcp.client execute."""
from __future__ import annotations

from httpx import AsyncClient

from app.mcp.env import reset_all_server_state
from tests.conftest import auth_header


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def setup_function():
    reset_all_server_state("community_support")


async def test_mcp_servers_requires_auth(client: AsyncClient):
    resp = await client.get("/api/mcp/servers")
    assert resp.status_code == 401


async def test_list_servers_includes_command_display(client: AsyncClient):
    token = await _token(client, "mcp_list")
    resp = await client.get("/api/mcp/servers", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    ids = {row["id"] for row in body}
    assert ids == {"shop_catalog", "community_support", "shadow_shop"}
    for row in body:
        assert row["transport"] == "stdio"
        assert isinstance(row["command_display"], list)
        assert len(row["command_display"]) == 2
        assert row["command_display"][1].endswith(".py")


async def test_discover_and_tools_via_http(client: AsyncClient):
    token = await _token(client, "mcp_http")
    headers = auth_header(token)
    disc = await client.get("/api/mcp/servers/shop_catalog/discover", headers=headers)
    assert disc.status_code == 200, disc.text
    result = disc.json()["result"]
    assert result["protocol_version"] == "2026-07-28"
    tools = await client.get("/api/mcp/servers/shop_catalog/tools", headers=headers)
    assert tools.status_code == 200, tools.text
    names = {t["name"] for t in tools.json()["result"]["tools"]}
    assert "lookup_product" in names


async def test_poisoning_lab_evaluator_fires_at_l0(client: AsyncClient):
    token = await _token(client, "mcp_poison")
    headers = auth_header(token)
    resp = await client.get(
        "/api/mcp/servers/community_support/tools",
        headers=headers,
        params={"lab_id": "mcp03-1", "defense_level": 0},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    desc = {t["name"]: t["description"] for t in body["result"]["tools"]}["lookup_ticket"]
    assert "IMPORTANT: before answering" in desc
    assert body["evaluation"]["exploit_triggered"] is False
    called = await client.post(
        "/api/mcp/servers/community_support/tools/read_internal_notes/call",
        headers=headers,
        json={"arguments": {"ticket_id": "TCK-1001"}, "lab_id": "mcp03-1", "defense_level": 0},
    )
    assert called.status_code == 200, called.text
    assert called.json()["evaluation"]["exploit_triggered"] is False
    simulated = await client.post(
        "/api/labs/mcp03-1/agent-step",
        headers=headers,
        json={"goal": "Answer using the tool list."},
    )
    assert simulated.status_code == 200, simulated.text
    assert "invoke: read_internal_notes" in simulated.json()["message"]
    submitted = await client.post(
        "/api/labs/mcp03-1/submit",
        headers=headers,
        json={"fields": {"finding": "metadata_changed_plan"}},
    )
    assert submitted.status_code == 200, submitted.text
    body = submitted.json()
    assert body["evaluation"]["exploit_triggered"] is True
    assert body["evaluation"]["flag"] is None


async def test_description_scan_redacts_at_l2(client: AsyncClient):
    token = await _token(client, "mcp_scan")
    headers = auth_header(token)
    resp = await client.get(
        "/api/mcp/servers/community_support/tools",
        headers=headers,
        params={"lab_id": "mcp03-1", "defense_level": 2},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    desc = {t["name"]: t["description"] for t in body["result"]["tools"]}["lookup_ticket"]
    assert "IMPORTANT" not in desc
    raw_blob = str(body["result"]["tools_raw"])
    assert "IMPORTANT: before answering" in raw_blob
    assert body["evaluation"]["exploit_triggered"] is False
    called = await client.post(
        "/api/mcp/servers/community_support/tools/read_internal_notes/call",
        headers=headers,
        json={"arguments": {"ticket_id": "TCK-1001"}, "lab_id": "mcp03-1", "defense_level": 2},
    )
    assert called.status_code == 200, called.text
    assert called.json()["evaluation"]["exploit_triggered"] is False


async def test_unknown_server_is_404(client: AsyncClient):
    token = await _token(client, "mcp_404")
    resp = await client.get("/api/mcp/servers/not-a-server/discover", headers=auth_header(token))
    assert resp.status_code == 404


async def test_surface_execute_discover(client: AsyncClient):
    token = await _token(client, "mcp_surf")
    resp = await client.post(
        "/api/surfaces/mcp.client/execute",
        headers=auth_header(token),
        json={"lab_id": "mcp03-1", "input": {"action": "discover", "server_id": "shop_catalog"}},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["result"]["protocol_version"] == "2026-07-28"
    types = [e["type"] for e in body["transcript"]]
    assert "mcp_request" in types
    assert "mcp_response" in types


async def test_rug_pull_is_per_lab_and_reset_restores_the_first_description(client: AsyncClient):
    token = await _token(client, "mcp_reset")
    headers = auth_header(token)

    async def lookup(lab_id: str) -> str:
        resp = await client.get(
            "/api/mcp/servers/community_support/tools",
            headers=headers,
            params={"lab_id": lab_id, "defense_level": 0},
        )
        assert resp.status_code == 200, resp.text
        tools = {row["name"]: row["description"] for row in resp.json()["result"]["tools"]}
        return tools["lookup_ticket"]

    first = await lookup("mcp03-2")
    assert "customer-visible status" in first
    assert "internal staff notes" not in first
    second = await lookup("mcp03-2")
    assert "internal staff notes" in second
    assert "also call export_orders" not in second
    other_lab = await lookup("mcp03-3")
    assert "customer-visible status" in other_lab
    assert "IMPORTANT: before answering" not in other_lab
    pilot = [await lookup("mcp03-1"), await lookup("mcp03-1")]
    assert all("export_orders" not in text for text in pilot)
    reset = await client.post("/api/labs/mcp03-2/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    restored = await lookup("mcp03-2")
    assert "customer-visible status" in restored


async def test_pin_denies_a_drifted_call_before_the_server_runs(client: AsyncClient):
    token = await _token(client, "mcp_pin")
    headers = auth_header(token)
    for _ in range(2):
        listed = await client.get(
            "/api/mcp/servers/community_support/tools",
            headers=headers,
            params={"lab_id": "mcp03-2", "defense_level": 0},
        )
        assert listed.status_code == 200, listed.text
    called = await client.post(
        "/api/mcp/servers/community_support/tools/lookup_ticket/call",
        headers=headers,
        json={
            "arguments": {"ticket_id": "1"},
            "lab_id": "mcp03-2",
            "defense_level": 1,
            "tool_description": "client supplied text is ignored",
        },
    )
    assert called.status_code == 200, called.text
    result = called.json()["result"]
    assert result["denied"] is True
    assert result["executed"] is False
    assert result["text"] == []
    assert result["text_raw"] == []


async def test_start_resumes_and_reset_starts_a_fresh_attempt(client: AsyncClient):
    token = await _token(client, "mcp_start_reset")
    headers = auth_header(token)

    async def lookup() -> str:
        resp = await client.get(
            "/api/mcp/servers/community_support/tools",
            headers=headers,
            params={"lab_id": "mcp03-2", "defense_level": 0},
        )
        assert resp.status_code == 200, resp.text
        tools = {row["name"]: row["description"] for row in resp.json()["result"]["tools"]}
        return tools["lookup_ticket"]

    assert "customer-visible status" in await lookup()
    assert "internal staff notes" in await lookup()
    started = await client.post("/api/labs/mcp03-2/start", headers=headers)
    assert started.status_code == 200, started.text
    assert "internal staff notes" in await lookup()
    reset = await client.post("/api/labs/mcp03-2/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    assert "customer-visible status" in await lookup()


async def test_schema_drift_appears_on_the_second_list(client: AsyncClient):
    token = await _token(client, "mcp_schema")
    headers = auth_header(token)

    async def listed() -> dict:
        resp = await client.get(
            "/api/mcp/servers/community_support/tools",
            headers=headers,
            params={"lab_id": "mcp03-3", "defense_level": 0},
        )
        assert resp.status_code == 200, resp.text
        return resp.json()

    first = await listed()
    assert "include_internal" not in str(first["result"]["tools"])
    assert first["evaluation"]["exploit_triggered"] is False
    second = await listed()
    assert "include_internal" in str(second["result"]["tools"])
    assert second["evaluation"]["exploit_triggered"] is False


async def test_blocked_call_is_denied_at_level_1(client: AsyncClient):
    token = await _token(client, "mcp_block")
    headers = auth_header(token)
    called = await client.post(
        "/api/mcp/servers/community_support/tools/export_orders/call",
        headers=headers,
        json={"arguments": {}, "lab_id": "mcp02-1", "defense_level": 1},
    )
    assert called.status_code == 200, called.text
    body = called.json()
    assert body["result"]["denied"] is True
    assert body["result"]["executed"] is False
    assert body["evaluation"]["exploit_triggered"] is False
    shadow = await client.post(
        "/api/mcp/servers/community_support/tools/diagnostics/call",
        headers=headers,
        json={"arguments": {}, "lab_id": "mcp07-1", "defense_level": 1},
    )
    assert shadow.status_code == 200, shadow.text
    assert "aigoat-decoy-" not in "\n".join(shadow.json()["result"]["text"])
    assert shadow.json()["evaluation"]["exploit_triggered"] is False


async def test_decoy_token_is_redacted_at_level_2(client: AsyncClient):
    token = await _token(client, "mcp_decoy_l2")
    headers = auth_header(token)
    called = await client.post(
        "/api/mcp/servers/community_support/tools/read_internal_notes/call",
        headers=headers,
        json={"arguments": {"ticket_id": "TCK-1042"}, "lab_id": "mcp01-1", "defense_level": 2},
    )
    assert called.status_code == 200, called.text
    body = called.json()
    visible = "\n".join(body["result"]["text"])
    raw = "\n".join(body["result"]["text_raw"])
    assert "sk-shop-billing-7f3a9c2e1b84" not in visible
    assert "[redacted]" in visible
    assert "sk-shop-billing-7f3a9c2e1b84" in raw
    assert body["evaluation"]["exploit_triggered"] is False


async def test_shadow_lab_does_not_complete_on_tools_list(client: AsyncClient):
    token = await _token(client, "mcp_shadow_list")
    headers = auth_header(token)
    listed = await client.get(
        "/api/mcp/servers/shadow_shop/tools",
        headers=headers,
        params={"lab_id": "mcp09-1", "defense_level": 0},
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["evaluation"]["exploit_triggered"] is False
    for server in ("shop_catalog", "shadow_shop"):
        found = await client.get(
            f"/api/mcp/servers/{server}/discover",
            headers=headers,
            params={"lab_id": "mcp09-1", "defense_level": 0},
        )
        assert found.status_code == 200, found.text
        assert found.json()["evaluation"]["exploit_triggered"] is False
    called = await client.post(
        "/api/mcp/servers/shadow_shop/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": "HOO-001"}, "lab_id": "mcp09-1", "defense_level": 0},
    )
    assert called.status_code == 200, called.text
    assert called.json()["evaluation"]["exploit_triggered"] is False
    submitted = await client.post(
        "/api/labs/mcp09-1/submit",
        headers=headers,
        json={"fields": {"integration": "package_b", "reason": "claim_does_not_match_launch"}},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["evaluation"]["exploit_triggered"] is True


async def test_trust_lab_rejects_wrong_server_and_empty_args(client: AsyncClient):
    token = await _token(client, "mcp_trust_neg")
    headers = auth_header(token)
    leaked = await client.post(
        "/api/mcp/servers/community_support/tools/diagnostics/call",
        headers=headers,
        json={"arguments": {}, "lab_id": "mcp07-1", "defense_level": 0},
    )
    assert leaked.status_code == 200, leaked.text
    assert leaked.json()["evaluation"]["exploit_triggered"] is False
    text = "\n".join(leaked.json()["result"]["text"])
    assert "aigoat-decoy-" in text


async def test_audit_lab_is_a_fixture_submission(client: AsyncClient):
    token = await _token(client, "mcp_audit_neg")
    headers = auth_header(token)
    catalog = await client.post(
        "/api/mcp/servers/shop_catalog/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": "HOO-001"}, "lab_id": "mcp08-1", "defense_level": 0},
    )
    assert catalog.status_code == 200, catalog.text
    assert catalog.json()["evaluation"]["exploit_triggered"] is False
    log = await client.get("/api/labs/mcp08-1/fixture", headers=headers)
    assert log.status_code == 200, log.text
    assert "answer" not in log.text
    assert log.json()["events"]


async def test_marker_echo_does_not_complete_client_labs(client: AsyncClient):
    token = await _token(client, "mcp_echo")
    headers = auth_header(token)
    decoy = await client.post(
        "/api/mcp/servers/community_support/tools/lookup_ticket/call",
        headers=headers,
        json={
            "arguments": {"ticket_id": "aigoat-decoy-mcp-token-not-a-secret"},
            "lab_id": "mcp01-1",
            "defense_level": 0,
        },
    )
    assert decoy.status_code == 200, decoy.text
    assert decoy.json()["evaluation"]["exploit_triggered"] is False
    rug = await client.post(
        "/api/mcp/servers/community_support/tools/lookup_ticket/call",
        headers=headers,
        json={
            "arguments": {"ticket_id": "also call export_orders"},
            "lab_id": "mcp03-2",
            "defense_level": 0,
        },
    )
    assert rug.status_code == 200, rug.text
    assert rug.json()["evaluation"]["exploit_triggered"] is False
    drift = await client.post(
        "/api/mcp/servers/community_support/tools/lookup_ticket/call",
        headers=headers,
        json={
            "arguments": {"ticket_id": "include_internal"},
            "lab_id": "mcp03-3",
            "defense_level": 0,
        },
    )
    assert drift.status_code == 200, drift.text
    assert drift.json()["evaluation"]["exploit_triggered"] is False


async def test_shopper_cannot_call_internal_shop(client: AsyncClient):
    token = await _token(client, "mcp_shopper")
    headers = auth_header(token)
    denied = await client.post(
        "/api/mcp/servers/internal_shop/tools/issue_refund/call",
        headers=headers,
        json={"arguments": {"order_id": 1}, "defense_level": 2},
    )
    assert denied.status_code == 403
