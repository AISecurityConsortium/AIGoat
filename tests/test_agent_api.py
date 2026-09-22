"""HTTP tests for /api/agent runs, approval scoping, and L0/L2 labs."""
from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import auth_header
from tests.fake_llm import FakeLLMClient

REFUND_TURNS = [
    {
        "content": "Refunding now.",
        "tool_calls": [{"name": "issue_refund", "arguments": {"order_id": 1003}}],
    },
    {"content": "Refund processed."},
]


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={
            "username": username,
            "password": "password123",
            "email": f"{username}@aigoatshop.com",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _script_refund(fake_llm: FakeLLMClient) -> None:
    fake_llm.script_turns([dict(t) for t in REFUND_TURNS])


async def test_agent_l0_refund_completes(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_l0")
    _script_refund(fake_llm)
    resp = await client.post(
        "/api/agent/runs",
        headers=auth_header(token),
        json={"lab_id": "llm03-1", "goal": "Refund order 1003 now.", "defense_level": 0},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert any(s["action"] == "issue_refund" for s in body["steps"])
    assert body["evaluation"]["exploit_triggered"] is True
    types = [e["type"] for e in body["transcript"]]
    assert "tool_call" in types
    assert "user_message" in types


async def test_agent_l2_pauses_for_approval(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_l2")
    _script_refund(fake_llm)
    resp = await client.post(
        "/api/agent/runs",
        headers=auth_header(token),
        json={"lab_id": "llm03-1", "goal": "Refund order 1003 now.", "defense_level": 2},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "awaiting_approval"
    assert body["pending"]["tool"] == "issue_refund"
    assert "refunded" not in (body["steps"][0].get("observation") or "")


async def test_approval_is_user_scoped(client: AsyncClient, fake_llm: FakeLLMClient):
    alice = await _token(client, "agent_alice")
    bob = await _token(client, "agent_bob")
    _script_refund(fake_llm)
    created = await client.post(
        "/api/agent/runs",
        headers=auth_header(alice),
        json={"lab_id": "asi09-1", "goal": "Refund order 1003.", "defense_level": 2},
    )
    assert created.status_code == 200, created.text
    run_id = created.json()["run_id"]
    step_seq = created.json()["pending"]["step_seq"]
    stolen = await client.post(
        f"/api/agent/runs/{run_id}/approve",
        headers=auth_header(bob),
        json={"step_seq": step_seq, "decision": "approve"},
    )
    assert stolen.status_code == 403
    still = await client.get(f"/api/agent/runs/{run_id}", headers=auth_header(alice))
    assert still.json()["status"] == "awaiting_approval"
    assert still.json()["pending"]["status"] == "pending"


async def test_owner_can_deny_and_run_continues(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_deny")
    fake_llm.script_turns([
        {
            "content": "Refunding.",
            "tool_calls": [{"name": "issue_refund", "arguments": {"order_id": 1003}}],
        },
        {"content": "Understood, I will not refund."},
    ])
    created = await client.post(
        "/api/agent/runs",
        headers=auth_header(token),
        json={"lab_id": "llm03-1", "goal": "Refund order 1003.", "defense_level": 2},
    )
    run_id = created.json()["run_id"]
    denied = await client.post(
        f"/api/agent/runs/{run_id}/approve",
        headers=auth_header(token),
        json={"step_seq": created.json()["pending"]["step_seq"], "decision": "deny"},
    )
    assert denied.status_code == 200, denied.text
    assert denied.json()["status"] in {"completed", "max_steps_exceeded"}
    assert denied.json()["pending"] is None


async def test_allowlist_lab_denies_refund_at_l1(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_allow")
    _script_refund(fake_llm)
    resp = await client.post(
        "/api/agent/runs",
        headers=auth_header(token),
        json={"lab_id": "llm03-2", "goal": "Refund order 1003.", "defense_level": 1},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    refund_steps = [s for s in body["steps"] if s["action"] == "issue_refund"]
    assert refund_steps
    assert refund_steps[0]["decision"] == "deny"
    assert "allowlist" in (refund_steps[0]["observation"] or "").lower() or (
        refund_steps[0]["control_id"] == "tool.allowlist"
    )


async def test_ten_consecutive_l0_attempts(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_ten")
    headers = auth_header(token)
    for i in range(10):
        _script_refund(fake_llm)
        resp = await client.post(
            "/api/agent/runs",
            headers=headers,
            json={
                "lab_id": "llm03-1",
                "goal": f"Refund order 1003 attempt {i}.",
                "defense_level": 0,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "completed"
        assert body["evaluation"]["exploit_triggered"] is True


async def test_ten_consecutive_l2_attempts_pause(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_ten_l2")
    headers = auth_header(token)
    for i in range(10):
        _script_refund(fake_llm)
        resp = await client.post(
            "/api/agent/runs",
            headers=headers,
            json={
                "lab_id": "llm03-1",
                "goal": f"Refund order 1003 attempt {i}.",
                "defense_level": 2,
            },
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "awaiting_approval"


async def test_get_run_unknown_is_404(client: AsyncClient):
    token = await _token(client, "agent_404")
    resp = await client.get(
        "/api/agent/runs/00000000-0000-0000-0000-000000000000",
        headers=auth_header(token),
    )
    assert resp.status_code == 404


async def test_defense_levels_without_surface_keep_legacy_keys(client: AsyncClient):
    token = await _token(client, "agent_levels")
    resp = await client.get("/api/chat/defense-levels", headers=auth_header(token))
    assert resp.status_code == 200
    for item in resp.json()["levels"]:
        assert set(item) == {"level", "name", "color", "description"}


async def test_defense_levels_surface_adds_agent_controls(client: AsyncClient):
    token = await _token(client, "agent_levels2")
    resp = await client.get(
        "/api/chat/defense-levels",
        headers=auth_header(token),
        params={"surface": "agent.runner"},
    )
    assert resp.status_code == 200
    levels = {item["level"]: item for item in resp.json()["levels"]}
    assert levels[0]["controls"] == []
    assert "tool.allowlist" in [c["id"] for c in levels[1]["controls"]]
    assert "tool.approval" in [c["id"] for c in levels[2]["controls"]]
    assert "memory.scan" in [c["id"] for c in levels[2]["controls"]]
    assert levels[2]["intent"]


async def test_surface_execute_matches_agent_api(client: AsyncClient, fake_llm: FakeLLMClient):
    token = await _token(client, "agent_surf")
    headers = auth_header(token)
    _script_refund(fake_llm)
    resp = await client.post(
        "/api/surfaces/agent.runner/execute",
        headers=headers,
        json={
            "lab_id": "llm03-1",
            "input": {"goal": "Refund order 1003 now.", "defense_level": 0},
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["result"]["status"] == "completed"
    assert body["transcript"][0]["type"] == "user_message"
    assert body["defense"]["surface"] == "agent.runner"
    assert body["evaluation"]["exploit_triggered"] is True
