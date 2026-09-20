"""Build a child environment by construction from an allowlist, never by copying os.environ."""
from __future__ import annotations

import os
from pathlib import Path

# PYTHONPATH is intentionally absent: it would put the repo (and secret_key)
# on the child's import path.
ALLOWED_ENV = frozenset({
    "PATH",
    "LANG",
    "LC_ALL",
    "PYTHONUNBUFFERED",
    "AIGOAT_MCP_SERVER_ID",
    "AIGOAT_MCP_DATA_DIR",
    "AIGOAT_MCP_OP",
})


def server_data_dir(server_id: str) -> Path:
    path = Path(os.environ.get("TMPDIR") or os.environ.get("TEMP") or "/tmp") / "aigoat-mcp-state" / server_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_child_env(server_id: str, data_dir: Path, op: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for key in ("PATH", "LANG", "LC_ALL"):
        value = os.environ.get(key)
        if value:
            env[key] = value
    env["PYTHONUNBUFFERED"] = "1"
    env["AIGOAT_MCP_SERVER_ID"] = server_id
    env["AIGOAT_MCP_DATA_DIR"] = str(data_dir)
    env["AIGOAT_MCP_OP"] = op
    assert set(env) <= ALLOWED_ENV
    return env


def reset_server_state(server_id: str) -> None:
    path = server_data_dir(server_id) / "list_count"
    try:
        path.unlink()
    except OSError:
        pass
