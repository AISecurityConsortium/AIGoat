"""Tests for cart endpoints."""
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
async def test_cart_requires_auth(client: AsyncClient):
    resp = await client.get("/api/cart/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_add_to_cart_rejects_zero_quantity(client: AsyncClient):
    token = await _signup_and_get_token(client, "cartzero")
    resp = await client.post(
        "/api/cart/",
        json={"product_id": 1, "quantity": 0},
        headers=auth_header(token),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_to_cart_rejects_negative_quantity(client: AsyncClient):
    token = await _signup_and_get_token(client, "cartneg")
    resp = await client.post(
        "/api/cart/",
        json={"product_id": 1, "quantity": -5},
        headers=auth_header(token),
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert any("greater than or equal to 1" in str(d.get("msg", "")) for d in detail)
