"""Tests for product endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_products_public(client: AsyncClient):
    resp = await client.get("/api/products/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_product_detail_not_found(client: AsyncClient):
    resp = await client.get("/api/products/99999/")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_search_returns_results(client: AsyncClient):
    resp = await client.get("/api/search/", params={"q": "shirt"})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data or isinstance(data, list)


@pytest.mark.asyncio
async def test_search_empty_query(client: AsyncClient):
    resp = await client.get("/api/search/", params={"q": ""})
    assert resp.status_code == 200
