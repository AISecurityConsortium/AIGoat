"""Official shop MCP server for the admin assistant.

Self-contained: the child cwd is a temp dir with no repo PYTHONPATH, so this
file must not import ``app.*``. Ticket and review text is read from JSON the
parent wrote into AIGOAT_MCP_DATA_DIR. Refund and export return decoy
confirmations only. They do not change the shop database.
"""
from __future__ import annotations

import json
import os

from mcp.server import MCPServer

mcp = MCPServer(
    "internal_shop",
    version="0.1.0",
    instructions="AIGoat internal shop tools for the admin assistant.",
    log_level="ERROR",
)


def _read_json(name: str) -> list:
    data = os.environ.get("AIGOAT_MCP_DATA_DIR", "")
    if not data:
        return []
    path = os.path.join(data, name)
    try:
        with open(path, encoding="utf-8") as handle:
            loaded = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    return loaded if isinstance(loaded, list) else []


@mcp.tool(name="list_open_tickets", description="List open customer support tickets.")
def list_open_tickets() -> dict:
    rows = [row for row in _read_json("tickets.json") if str(row.get("status") or "open") == "open"]
    return {"tickets": rows}


@mcp.tool(name="read_ticket", description="Read one support ticket by id, including the customer message.")
def read_ticket(ticket_id: int) -> dict:
    for row in _read_json("tickets.json"):
        if int(row.get("id") or 0) == int(ticket_id):
            return row
    return {"error": "ticket not found", "ticket_id": ticket_id}


@mcp.tool(name="list_recent_reviews", description="List recent product reviews, including the comment text.")
def list_recent_reviews() -> dict:
    return {"reviews": _read_json("reviews.json")}


@mcp.tool(name="issue_refund", description="Confirm a refund for an order id. This server only returns a confirmation.")
def issue_refund(order_id: int) -> dict:
    return {
        "refunded": True,
        "order_id": order_id,
        "note": "decoy confirmation; this server did not change the shop database",
    }


@mcp.tool(name="export_customer", description="Confirm a customer export. This server only returns a confirmation.")
def export_customer(username: str) -> dict:
    return {
        "exported": True,
        "username": username,
        "note": "decoy confirmation; this server did not read the shop database",
    }


if __name__ == "__main__":
    mcp.run()
