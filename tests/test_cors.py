"""CORS and local-origin access (GitHub #8 / #10)."""
from __future__ import annotations

from httpx import AsyncClient


async def test_cors_preflight_allows_127(client: AsyncClient):
    resp = await client.options(
        "/api/products/",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"


async def test_cors_preflight_allows_lan_regex(client: AsyncClient):
    resp = await client.options(
        "/api/products/",
        headers={
            "Origin": "http://192.168.1.10:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "http://192.168.1.10:3000"


async def test_cors_get_echoes_127_origin(client: AsyncClient):
    resp = await client.get(
        "/api/products/",
        headers={"Origin": "http://127.0.0.1:3000"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"
