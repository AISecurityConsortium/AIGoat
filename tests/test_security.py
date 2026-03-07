"""Security-focused tests -- validates that protective boundaries work."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


async def _signup_and_get_token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "pass123"},
    )
    return resp.json()["token"]


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_non_admin(client: AsyncClient):
    token = await _signup_and_get_token(client, "normaluser_sec")
    resp = await client.get(
        "/api/admin/dashboard/",
        headers=auth_header(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_invalid_token_rejected(client: AsyncClient):
    resp = await client.get(
        "/api/cart/",
        headers=auth_header("totally_bogus_token"),
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_sql_injection_safe(client: AsyncClient):
    resp = await client.get(
        "/api/search/",
        params={"q": "' OR 1=1 --"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_profile_requires_auth(client: AsyncClient):
    resp = await client.get("/api/profile/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_knowledge_base_requires_auth(client: AsyncClient):
    resp = await client.get("/api/knowledge-base/")
    assert resp.status_code == 401
