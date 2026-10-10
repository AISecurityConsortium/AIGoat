"""Build a child environment by construction from an allowlist, never by copying os.environ."""
from __future__ import annotations

import hashlib
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
    "AIGOAT_MCP_LAB_ID",
    "AIGOAT_MCP_CANARY_STAFF_TOKEN",
})


def _scope_name(scope: str | None) -> str | None:
    if not scope:
        return None
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in str(scope))[:64]
    return safe or None


def learner_scope(user_id: object, lab_id: str | None = None, attempt: int | None = None) -> str:
    """Per-learner directory. A lab id and attempt keep one exercise from consuming the next."""
    base = f"user-{user_id}"
    if lab_id:
        base = f"{base}-{lab_id}"
    if attempt:
        base = f"{base}-a{int(attempt)}"
    return _scope_name(base) or "user"


def _state_root() -> Path:
    return Path(os.environ.get("TMPDIR") or os.environ.get("TEMP") or "/tmp") / "aigoat-mcp-state"


def server_data_dir(server_id: str, scope: str | None = None) -> Path:
    root = _state_root()
    name = _scope_name(scope)
    path = root / name / server_id if name else root / server_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_child_env(
    server_id: str,
    data_dir: Path,
    op: str,
    lab_id: str | None = None,
    level: int | None = None,
) -> dict[str, str]:
    env: dict[str, str] = {}
    for key in ("PATH", "LANG", "LC_ALL"):
        value = os.environ.get(key)
        if value:
            env[key] = value
    env["PYTHONUNBUFFERED"] = "1"
    env["AIGOAT_MCP_SERVER_ID"] = server_id
    env["AIGOAT_MCP_DATA_DIR"] = str(data_dir)
    env["AIGOAT_MCP_OP"] = op
    safe_lab = _scope_name(lab_id)
    if safe_lab:
        env["AIGOAT_MCP_LAB_ID"] = safe_lab
    # mcp07-1 only. Level 0 hands one staff token to every server. Higher levels
    # keep it on the official catalog server. Other labs never receive it.
    if safe_lab == "mcp07-1":
        scoped = level is not None and level >= 1 and server_id != "shop_catalog"
        if not scoped:
            token = hashlib.sha256(data_dir.parent.name.encode()).hexdigest()[:12]
            env["AIGOAT_MCP_CANARY_STAFF_TOKEN"] = f"aigoat-decoy-{token}"
    assert set(env) <= ALLOWED_ENV
    return env


def reset_server_state(server_id: str, scope: str | None = None) -> None:
    path = server_data_dir(server_id, scope) / "list_count"
    try:
        path.unlink()
    except OSError:
        pass


def reset_all_server_state(server_id: str) -> None:
    """Drop list counters for one server in every learner scope. Tests only."""
    root = _state_root()
    if not root.is_dir():
        return
    for path in root.rglob("list_count"):
        if path.parent.name == server_id:
            try:
                path.unlink()
            except OSError:
                pass
