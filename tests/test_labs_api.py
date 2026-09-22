"""Tests for the enriched labs API (T022)."""
from __future__ import annotations

from pathlib import Path

from httpx import AsyncClient

from tests.conftest import auth_header

_NEW_KEYS = {
    "risks",
    "primary_risk",
    "surface",
    "difficulty",
    "objective",
    "prerequisites",
    "attack_steps",
    "example_payloads",
    "expected_by_level",
    "remediation",
    "references",
    "challenge_id",
    "related_lab_ids",
}
_OLD_KEYS = {
    "id",
    "name",
    "owasp",
    "status",
    "defense_override",
    "description",
    "started_at",
    "completed_at",
    "reset_count",
}


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "pass123"},
    )
    return resp.json()["token"]


async def test_list_labs_requires_auth(client: AsyncClient):
    resp = await client.get("/api/labs/")
    assert resp.status_code == 401


async def test_list_labs_has_old_and_new_keys(client: AsyncClient):
    token = await _token(client, "lablist")
    resp = await client.get("/api/labs/", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 14
    for item in data:
        assert _OLD_KEYS <= set(item)
        assert _NEW_KEYS <= set(item)


async def test_list_labs_surface_filter(client: AsyncClient):
    token = await _token(client, "labsurf")
    resp = await client.get("/api/labs/", params={"surface": "rag.kb"}, headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data
    assert all(item["surface"] == "rag.kb" for item in data)


async def test_list_labs_difficulty_filter(client: AsyncClient):
    token = await _token(client, "labdiff")
    resp = await client.get(
        "/api/labs/", params={"difficulty": "beginner"}, headers=auth_header(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data
    assert all(item["difficulty"] == "beginner" for item in data)


async def test_list_labs_risk_filter(client: AsyncClient):
    token = await _token(client, "labrisk")
    resp = await client.get(
        "/api/labs/",
        params={"risk": "owasp-llm-2026:LLM01"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    ids = {item["id"] for item in resp.json()}
    assert {"llm01-1", "llm01-2", "llm01-3"} <= ids


async def test_list_labs_primary_only_excludes_cross_tagged(client: AsyncClient):
    token = await _token(client, "labprimary")
    headers = auth_header(token)
    all_llm01 = await client.get(
        "/api/labs/",
        params={"risk": "owasp-llm-2026:LLM01"},
        headers=headers,
    )
    primary = await client.get(
        "/api/labs/",
        params={"risk": "owasp-llm-2026:LLM01", "primary_only": True},
        headers=headers,
    )
    assert all_llm01.status_code == 200
    assert primary.status_code == 200
    all_ids = {item["id"] for item in all_llm01.json()}
    primary_ids = {item["id"] for item in primary.json()}
    assert {"llm01-1", "llm01-2", "llm01-3"} <= primary_ids
    assert "mcp03-1" in all_ids
    assert "mcp03-1" not in primary_ids
    assert all(item["primary_risk"] == "owasp-llm-2026:LLM01" for item in primary.json())


async def test_get_lab_detail(client: AsyncClient):
    token = await _token(client, "labone")
    resp = await client.get("/api/labs/llm01-1", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["objective"]


async def test_related_lab_ids_uncapped_and_excludes_self(client: AsyncClient):
    token = await _token(client, "labrelated")
    resp = await client.get("/api/labs/mcp03-1", headers=auth_header(token))
    assert resp.status_code == 200
    related = resp.json()["related_lab_ids"]
    assert "mcp03-1" not in related
    assert len(related) > 5
    assert len(related) == len(set(related))


async def test_get_lab_missing(client: AsyncClient):
    token = await _token(client, "labmiss")
    resp = await client.get("/api/labs/nope", headers=auth_header(token))
    assert resp.status_code == 404


async def test_responses_do_not_include_prompt_file_text(client: AsyncClient):
    token = await _token(client, "labprompt")
    prompt = (Path("prompts/labs/prompt_injection.md").read_text().splitlines()[0])
    resp = await client.get("/api/labs/", headers=auth_header(token))
    blob = resp.text
    assert prompt not in blob
    detail = await client.get("/api/labs/llm01-1", headers=auth_header(token))
    assert prompt not in detail.text


async def test_start_lab(client: AsyncClient):
    token = await _token(client, "labstart")
    headers = auth_header(token)
    first = await client.post("/api/labs/llm01-1/start", headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["lab_id"] == "llm01-1"
    assert body["already_started"] is False
    second = await client.post("/api/labs/llm01-1/start", headers=headers)
    assert second.status_code == 200
    assert second.json()["already_started"] is True


async def test_start_lab_missing(client: AsyncClient):
    token = await _token(client, "labstartmiss")
    resp = await client.post("/api/labs/nope/start", headers=auth_header(token))
    assert resp.status_code == 404
