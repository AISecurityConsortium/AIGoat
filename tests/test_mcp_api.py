"""HTTP tests for /api/mcp and mcp.client execute."""
from __future__ import annotations

from httpx import AsyncClient

from app.mcp.env import reset_server_state
from tests.conftest import auth_header


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def setup_function():
    reset_server_state("community_support")


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
    assert body["evaluation"]["exploit_triggered"] is True


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
