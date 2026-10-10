"""Public taxonomy API tests (T013)."""
from __future__ import annotations


class TestTaxonomyAPI:
    async def test_list_frameworks_is_public(self, client):
        resp = await client.get("/api/frameworks/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 3

    async def test_get_framework_includes_attribution(self, client):
        resp = await client.get("/api/frameworks/owasp-llm-2026")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["risks"]) == 10
        assert data.get("attribution")

    async def test_get_framework_missing(self, client):
        resp = await client.get("/api/frameworks/nope")
        assert resp.status_code == 404
        assert "detail" in resp.json()

    async def test_list_risks_count(self, client):
        resp = await client.get("/api/risks/")
        assert resp.status_code == 200
        assert len(resp.json()) == 30

    async def test_list_risks_framework_filter(self, client):
        resp = await client.get("/api/risks/", params={"framework": "owasp-llm-2026"})
        assert resp.status_code == 200
        assert len(resp.json()) == 10

    async def test_list_risks_surface_filter(self, client):
        resp = await client.get("/api/risks/", params={"surface": "rag.kb"})
        assert resp.status_code == 200
        data = resp.json()
        assert data
        assert all("rag.kb" in item["attack_surfaces"] for item in data)

    async def test_list_risks_query(self, client):
        resp = await client.get("/api/risks/", params={"q": "injection"})
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_get_risk_url_encoded(self, client):
        resp = await client.get("/api/risks/owasp-llm-2026%3ALLM01")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == "LLM01"
        assert data["lab_ids"]
        assert data["labs"]
        assert data["labs"][0]["surface"]

    async def test_get_risk_missing(self, client):
        resp = await client.get("/api/risks/owasp-llm-2026:LLM99")
        assert resp.status_code == 404

    async def test_mcp_maturity_note(self, client):
        resp = await client.get("/api/frameworks/owasp-mcp-2025")
        assert resp.status_code == 200
        assert resp.json().get("maturity_note")
