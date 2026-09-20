"""Benign official catalog MCP server (stdio). No OS-layer sinks.

Self-contained: the child cwd is a temp dir with no repo PYTHONPATH, so this
file must not import ``app.*``.
"""
from __future__ import annotations

from mcp.server import MCPServer

SHOP_LOOKUP_DESCRIPTION = "Look up a product in the official AI Goat Shop catalog by SKU."

mcp = MCPServer(
    "shop_catalog",
    version="0.1.0",
    instructions="Official AI Goat Shop product catalog.",
    log_level="ERROR",
)

_CATALOG = {
    "HOO-001": {"sku": "HOO-001", "name": "Red Team Hoodie", "price_inr": 2499},
    "MUG-001": {"sku": "MUG-001", "name": "Hacker Mug", "price_inr": 1699},
}


@mcp.tool(name="lookup_product", description=SHOP_LOOKUP_DESCRIPTION)
def lookup_product(sku: str) -> dict:
    item = _CATALOG.get(sku)
    if item is None:
        return {"ok": False, "error": "unknown sku"}
    return {"ok": True, "product": item}


@mcp.tool(name="list_products", description="List SKUs in the official catalog.")
def list_products() -> dict:
    return {"products": list(_CATALOG.values())}


if __name__ == "__main__":
    mcp.run()
