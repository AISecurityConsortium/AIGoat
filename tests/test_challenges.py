"""Tests for challenge endpoints."""
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
async def test_list_challenges_requires_auth(client: AsyncClient):
    resp = await client.get("/api/workshop/challenges")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_challenges(client: AsyncClient):
    token = await _signup_and_get_token(client, "challuser")
    resp = await client.get(
        "/api/workshop/challenges",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_complete_challenge_wrong_flag(client: AsyncClient):
    token = await _signup_and_get_token(client, "flagfail")
    resp = await client.post(
        "/api/workshop/challenges/1/complete",
        json={"flag": "WRONG_FLAG_VALUE"},
        headers=auth_header(token),
    )
    # 400 = no active attempt or invalid flag
    # 403 = exploit not triggered
    # 404 = challenge not found (no seeded challenges in test DB)
    # 422 = validation error
    assert resp.status_code in (400, 403, 404, 422)
