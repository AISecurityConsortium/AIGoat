"""Tests for system/utility endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_feature_flags(client: AsyncClient):
    resp = await client.get("/api/feature-flags/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "admin_dashboard" in data
    assert "rag_system" in data


@pytest.mark.asyncio
async def test_ollama_status(client: AsyncClient):
    resp = await client.get("/api/ollama/status/")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data or "available" in data


@pytest.mark.asyncio
async def test_labs_list_requires_auth(client: AsyncClient):
    resp = await client.get("/api/labs/")
    assert resp.status_code == 401
