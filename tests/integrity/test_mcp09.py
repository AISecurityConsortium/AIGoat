"""Challenge integrity for mcp09-1. Page load and partial paths must not complete."""
from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import auth_header


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def _open(client, headers, server, kind="discover"):
    if kind == "discover":
        return await client.get(
            f"/api/mcp/servers/{server}/discover",
            headers=headers,
            params={"lab_id": "mcp09-1", "defense_level": 0},
        )
    return await client.get(
        f"/api/mcp/servers/{server}/tools",
        headers=headers,
        params={"lab_id": "mcp09-1", "defense_level": 0},
    )


def _met(resp) -> bool:
    return bool(resp.json()["evaluation"]["exploit_triggered"])


async def test_page_load_sequence_does_not_complete(client: AsyncClient):
    token = await _token(client, "int_load")
    headers = auth_header(token)
    started = await client.post("/api/labs/mcp09-1/start", headers=headers)
    assert started.status_code == 200
    for server in ("shop_catalog", "shadow_shop", "community_support"):
        for kind in ("discover", "tools"):
            resp = await _open(client, headers, server, kind)
            assert resp.status_code == 200, resp.text
            assert _met(resp) is False


async def test_wrong_server_empty_args_and_bad_submission(client: AsyncClient):
    token = await _token(client, "int_neg")
    headers = auth_header(token)
    for server in ("shop_catalog", "shadow_shop"):
        assert _met(await _open(client, headers, server)) is False
    wrong = await client.post(
        "/api/mcp/servers/shop_catalog/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": "HOO-001"}, "lab_id": "mcp09-1", "defense_level": 0},
    )
    assert wrong.status_code == 200, wrong.text
    assert _met(wrong) is False
    empty = await client.post(
        "/api/mcp/servers/shadow_shop/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": ""}, "lab_id": "mcp09-1", "defense_level": 0},
    )
    assert empty.status_code == 200, empty.text
    assert _met(empty) is False
    good = await client.post(
        "/api/mcp/servers/shadow_shop/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": "HOO-001"}, "lab_id": "mcp09-1", "defense_level": 0},
    )
    assert good.status_code == 200, good.text
    bad = await client.post(
        "/api/labs/mcp09-1/submit",
        headers=headers,
        json={"fields": {"integration": "package_a", "reason": "claim_does_not_match_launch"}},
    )
    assert bad.status_code == 200, bad.text
    assert bad.json()["evaluation"]["exploit_triggered"] is False
    assert bad.json()["evaluation"]["reason_code"] == "submission_mismatch"
    assert bad.json()["evaluation"]["reason_detail"] == "integration"
    wrong_reason = await client.post(
        "/api/labs/mcp09-1/submit",
        headers=headers,
        json={"fields": {"integration": "package_b", "reason": "same_tool_names"}},
    )
    assert wrong_reason.json()["evaluation"]["reason_code"] == "submission_mismatch"
    assert wrong_reason.json()["evaluation"]["reason_detail"] == "reason"


async def test_solution_reveal_does_not_complete(client: AsyncClient):
    token = await _token(client, "int_reveal")
    headers = auth_header(token)
    revealed = await client.post("/api/labs/mcp09-1/solution", headers=headers)
    assert revealed.status_code == 200, revealed.text
    assert revealed.json()["completed"] is False
    progress = await client.get("/api/labs/mcp09-1/progress", headers=headers)
    assert progress.status_code == 200, progress.text
    body = progress.json()
    assert body["completed"] is False
    assert body["solution_revealed"] is True
    assert "raw_digest" not in progress.text
    assert "provenance" not in progress.text


async def test_positive_path_then_reset_rejects_the_old_answer(client: AsyncClient):
    token = await _token(client, "int_pos")
    headers = auth_header(token)
    for server in ("shop_catalog", "shadow_shop"):
        resp = await _open(client, headers, server)
        assert resp.status_code == 200, resp.text
    called = await client.post(
        "/api/mcp/servers/shadow_shop/tools/lookup_product/call",
        headers=headers,
        json={"arguments": {"sku": "HOO-001"}, "lab_id": "mcp09-1", "defense_level": 0},
    )
    assert called.status_code == 200, called.text
    done = await client.post(
        "/api/labs/mcp09-1/submit",
        headers=headers,
        json={"fields": {"integration": "package_b", "reason": "claim_does_not_match_launch"}},
    )
    assert done.status_code == 200, done.text
    assert done.json()["evaluation"]["exploit_triggered"] is True
    reset = await client.post("/api/labs/mcp09-1/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    replay = await client.post(
        "/api/labs/mcp09-1/submit",
        headers=headers,
        json={"fields": {"integration": "package_b", "reason": "claim_does_not_match_launch"}},
    )
    assert replay.json()["evaluation"]["exploit_triggered"] is False
