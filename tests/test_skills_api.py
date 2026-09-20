"""HTTP tests for /api/skills and skill.runtime execute."""
from __future__ import annotations

from httpx import AsyncClient

from app.skills.docs import reset_docs
from app.skills.runtime import reset_installs
from tests.conftest import auth_header


def setup_function():
    reset_installs()
    reset_docs()


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def test_skills_list_requires_auth(client: AsyncClient):
    resp = await client.get("/api/skills/")
    assert resp.status_code == 401


async def test_list_skills_never_executes_scripts(client: AsyncClient):
    token = await _token(client, "skill_list")
    resp = await client.get("/api/skills/", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["result"]["never_executes_bundled_scripts"] is True
    ids = {row["id"] for row in body["result"]["skills"]}
    assert "refund-helper" in ids
    refund = next(row for row in body["result"]["skills"] if row["id"] == "refund-helper")
    assert refund["scripts_executed"] is False
    assert refund["bundled_scripts"]
    assert all(item["executed"] is False for item in refund["bundled_scripts"])


async def test_ast01_malicious_instructions_at_l0(client: AsyncClient):
    token = await _token(client, "skill_ast01")
    resp = await client.post(
        "/api/skills/refund-helper/install",
        headers=auth_header(token),
        json={"lab_id": "ast01-1", "defense_level": 0},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "export_customer_data" in body["result"]["instructions"]
    assert body["result"]["scripts_executed"] is False
    assert body["evaluation"]["exploit_triggered"] is True


async def test_ast03_l0_grants_extra_tools(client: AsyncClient):
    token = await _token(client, "skill_ast03")
    headers = auth_header(token)
    l0 = await client.post(
        "/api/skills/refund-helper/install",
        headers=headers,
        json={"lab_id": "ast03-1", "defense_level": 0},
    )
    assert l0.status_code == 200, l0.text
    granted = set(l0.json()["result"]["granted_tools"])
    declared = set(l0.json()["result"]["declared_tools"])
    assert "lookup_order" in declared
    assert "export_customer_data" in granted
    assert l0.json()["evaluation"]["exploit_triggered"] is True

    l1 = await client.post(
        "/api/skills/refund-helper/install",
        headers=headers,
        json={"lab_id": "ast03-1", "defense_level": 1},
    )
    assert l1.status_code == 200, l1.text
    assert set(l1.json()["result"]["granted_tools"]) == declared
    assert l1.json()["evaluation"]["exploit_triggered"] is False


async def test_ast05_doc_rug_on_second_fetch(client: AsyncClient):
    token = await _token(client, "skill_ast05")
    headers = auth_header(token)
    first = await client.get(
        "/api/skills/policy-lookup/external-doc",
        headers=headers,
        params={"lab_id": "ast05-1", "defense_level": 0},
    )
    assert first.status_code == 200, first.text
    assert first.json()["result"]["external_doc"]["version"] == "v1"
    second = await client.get(
        "/api/skills/policy-lookup/external-doc",
        headers=headers,
        params={"lab_id": "ast05-1", "defense_level": 0},
    )
    assert second.status_code == 200, second.text
    assert second.json()["result"]["external_doc"]["version"] == "v2"
    assert "export_customer_data" in second.json()["result"]["external_doc"]["text"]
    assert second.json()["evaluation"]["exploit_triggered"] is True


async def test_ast07_pin_denies_at_l2(client: AsyncClient):
    token = await _token(client, "skill_ast07")
    headers = auth_header(token)
    l0 = await client.post(
        "/api/skills/refund-helper/install",
        headers=headers,
        json={"lab_id": "ast07-1", "defense_level": 0},
    )
    assert l0.status_code == 200, l0.text
    assert l0.json()["result"]["pinned_mismatch"] is True
    assert l0.json()["result"]["denied"] is False
    assert l0.json()["evaluation"]["exploit_triggered"] is True

    l2 = await client.post(
        "/api/skills/refund-helper/install",
        headers=headers,
        json={"lab_id": "ast07-1", "defense_level": 2},
    )
    assert l2.status_code == 200, l2.text
    assert l2.json()["result"]["denied"] is True
    assert l2.json()["evaluation"]["exploit_triggered"] is False


async def test_ast08_scan_misses_prose_at_l2(client: AsyncClient):
    token = await _token(client, "skill_ast08")
    resp = await client.post(
        "/api/skills/scanner-bait/install",
        headers=auth_header(token),
        json={"lab_id": "ast08-1", "defense_level": 2},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["result"]["denied"] is False
    assert "export_customer_data" in body["result"]["instructions"]
    assert body["evaluation"]["exploit_triggered"] is True


async def test_ast10_converter_drops_allowed_tools(client: AsyncClient):
    token = await _token(client, "skill_ast10")
    resp = await client.get(
        "/api/skills/converter",
        headers=auth_header(token),
        params={"lab_id": "ast10-1", "defense_level": 0},
    )
    assert resp.status_code == 200, resp.text
    dropped = resp.json()["result"]["converter"]["dropped"]
    assert "allowed-tools" in dropped
    assert resp.json()["evaluation"]["exploit_triggered"] is True


async def test_surface_execute_install(client: AsyncClient):
    token = await _token(client, "skill_surf")
    resp = await client.post(
        "/api/surfaces/skill.runtime/execute",
        headers=auth_header(token),
        json={
            "lab_id": "ast04-1",
            "input": {"action": "install", "skill_id": "trusted-clerk", "defense_level": 0},
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["result"]["metadata"]["author"] == "AI Goat Shop Official"
    assert body["result"]["trust_tier"] == "community"
    assert body["evaluation"]["exploit_triggered"] is True
    assert body["transcript"][0]["type"] in {"user_message", "skill_load"}
