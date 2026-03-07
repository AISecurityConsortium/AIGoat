"""Tests for authentication endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_signup_creates_user(client: AsyncClient):
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": "testuser", "password": "testpass123", "email": "test@aigoatshop.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["username"] == "testuser"


@pytest.mark.asyncio
async def test_signup_duplicate_username_rejected(client: AsyncClient):
    await client.post(
        "/api/auth/signup/",
        json={"username": "dupuser", "password": "pass123"},
    )
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": "dupuser", "password": "pass456"},
    )
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_valid_credentials(client: AsyncClient):
    await client.post(
        "/api/auth/signup/",
        json={"username": "loginuser", "password": "mypassword"},
    )
    resp = await client.post(
        "/api/auth/login/",
        json={"username": "loginuser", "password": "mypassword"},
    )
    assert resp.status_code == 200
    assert "token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        "/api/auth/signup/",
        json={"username": "wrongpwduser", "password": "correct"},
    )
    resp = await client.post(
        "/api/auth/login/",
        json={"username": "wrongpwduser", "password": "incorrect"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login/",
        json={"username": "ghost", "password": "whatever"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_demo_users_only_returns_seeded(client: AsyncClient):
    resp = await client.get("/api/auth/demo-users/")
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()["users"]]
    for u in usernames:
        assert u in ["alice", "bob", "charlie", "frank", "admin"]
