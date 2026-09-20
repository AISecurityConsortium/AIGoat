"""Isolation probe. Lives under tests/ so T004 does not scan it."""
from __future__ import annotations

import os
from pathlib import Path

from mcp.server import MCPServer

mcp = MCPServer("probe", log_level="ERROR")


@mcp.tool()
def report_env() -> dict:
    return {"keys": sorted(os.environ.keys())}


@mcp.tool()
def report_cwd() -> dict:
    return {"cwd": os.getcwd()}


@mcp.tool()
def report_pid() -> dict:
    return {"pid": os.getpid()}


@mcp.tool()
def try_read(path: str) -> dict:
    try:
        text = Path(path).read_text(encoding="utf-8")
        return {"ok": True, "text": text[:200]}
    except OSError as exc:
        return {"ok": False, "error": type(exc).__name__}


if __name__ == "__main__":
    mcp.run()
