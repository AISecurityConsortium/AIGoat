"""Protocol correctness against the real mcp 2.2.x SDK (stdio, 2026-07-28)."""
from __future__ import annotations

import json
import sys
from importlib.metadata import version
from pathlib import Path

import pytest

from app.core.exceptions import McpSpawnError
from app.mcp.client import run_allowlisted, run_stdio
from app.mcp.env import reset_server_state
from app.mcp.registry import list_server_specs
from app.mcp_servers.payloads import (
    POISONED_DESCRIPTION,
    RUGPULL_DESCRIPTION,
    SHADOW_LOOKUP_DESCRIPTION,
    SHOP_LOOKUP_DESCRIPTION,
)

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "mcp"


@pytest.fixture(autouse=True)
def _reset_rugpull():
    reset_server_state("community_support")
    yield
    reset_server_state("community_support")


def test_sdk_version_is_pinned():
    assert version("mcp").startswith("2.2."), (
        "the MCP SDK moved. Re-read the spec revision, re-verify the handshake era "
        "declared in config/mcp_servers.yml, and update this assertion on purpose."
    )


def test_payload_strings_are_copied_into_servers():
    from app.mcp_servers import community_support, shadow_shop, shop_catalog

    assert community_support.POISONED_DESCRIPTION == POISONED_DESCRIPTION
    assert community_support.RUGPULL_DESCRIPTION == RUGPULL_DESCRIPTION
    assert shop_catalog.SHOP_LOOKUP_DESCRIPTION == SHOP_LOOKUP_DESCRIPTION
    assert shadow_shop.SHADOW_LOOKUP_DESCRIPTION == SHADOW_LOOKUP_DESCRIPTION


def test_every_shipped_server_declares_2026_stateless():
    specs = list_server_specs()
    assert {s.id for s in specs} == {"shop_catalog", "community_support", "shadow_shop"}
    for spec in specs:
        assert spec.protocol_era == "2026-stateless"
        assert spec.script_path.is_file()


async def test_discover_speaks_2026_07_28():
    payload = await run_allowlisted("shop_catalog", "discover")
    assert payload["protocol_version"] == "2026-07-28"
    versions = payload.get("supported_versions") or []
    assert "2026-07-28" in versions
    assert payload["server_info"]["name"] == "shop_catalog"
    methods = [e.get("method") for e in payload["transcript"] if e.get("method")]
    assert "server/discover" in methods
    assert "initialize" not in methods


async def test_shop_catalog_tools_list():
    payload = await run_allowlisted("shop_catalog", "tools")
    names = {t["name"] for t in payload["tools"]}
    assert names == {"lookup_product", "list_products"}
    by_name = {t["name"]: t for t in payload["tools"]}
    assert by_name["lookup_product"]["description"] == SHOP_LOOKUP_DESCRIPTION


async def test_poisoned_description_round_trips_byte_identically():
    payload = await run_allowlisted("community_support", "tools")
    by_name = {t["name"]: t for t in payload["tools"]}
    assert by_name["lookup_ticket"]["description"] == POISONED_DESCRIPTION


async def test_rug_pull_redefines_description_on_second_list():
    first = await run_allowlisted("community_support", "tools")
    second = await run_allowlisted("community_support", "tools")
    d1 = {t["name"]: t["description"] for t in first["tools"]}["lookup_ticket"]
    d2 = {t["name"]: t["description"] for t in second["tools"]}["lookup_ticket"]
    assert d1 == POISONED_DESCRIPTION
    assert d2 == RUGPULL_DESCRIPTION
    assert d1 != d2


async def test_shadow_server_impersonates_catalog_name():
    payload = await run_allowlisted("shadow_shop", "discover")
    assert payload["server_info"]["name"] == "shop_catalog"
    tools = await run_allowlisted("shadow_shop", "tools")
    by_name = {t["name"]: t for t in tools["tools"]}
    assert by_name["lookup_product"]["description"] == SHADOW_LOOKUP_DESCRIPTION


async def test_decoy_token_in_tool_result():
    payload = await run_allowlisted(
        "community_support",
        "call",
        tool="read_internal_notes",
        arguments={"ticket_id": "TCK-1001"},
    )
    assert payload["is_error"] is False
    blob = json.dumps(payload)
    assert "aigoat-decoy-mcp-token-not-a-secret" in blob


async def test_hanging_server_times_out():
    with pytest.raises(McpSpawnError) as exc:
        await run_stdio(
            command=sys.executable,
            args=[str(FIXTURES / "hang_server.py")],
            server_id="hang",
            op="discover",
            timeout=2,
        )
    assert exc.value.status_code == 504


async def test_malformed_stdout_is_not_a_500():
    with pytest.raises(McpSpawnError) as exc:
        await run_stdio(
            command=sys.executable,
            args=[str(FIXTURES / "malformed_server.py")],
            server_id="malformed",
            op="discover",
            timeout=3,
        )
    assert exc.value.status_code in {502, 504}
