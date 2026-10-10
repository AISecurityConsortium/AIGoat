"""Isolation claims for MCP stdio spawn (02-architecture.md §2.10)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

from app.core.exceptions import McpSpawnError, NotFoundError
from app.mcp.client import run_stdio
from app.mcp.env import ALLOWED_ENV, build_child_env, server_data_dir
from app.mcp.registry import get_server_spec

ROOT = Path(__file__).resolve().parent.parent
PROBE = Path(__file__).resolve().parent / "fixtures" / "mcp" / "probe_server.py"
REPO_ROOT = ROOT

POISON = {
    "AIGOAT_SECRET": "should-not-leak",
    "AWS_ACCESS_KEY_ID": "AKIAIOSFODNN7EXAMPLE",
    "GITHUB_TOKEN": "ghp_should_not_leak",
    "OPENAI_API_KEY": "sk-should-not-leak",
    "CONFIG_PATH": "/repo/config/config.yml",
    "DATABASE_URL": "sqlite+aiosqlite:///./aigoat.db",
    "SSH_AUTH_SOCK": "/tmp/ssh-agent.sock",
}


def _parse(payload: dict) -> dict:
    if payload.get("structured_content"):
        content = payload["structured_content"]
        if isinstance(content, dict) and "result" in content:
            return content["result"]
        return content
    return json.loads(payload["text"][0])


async def _call(tool: str, arguments: dict | None = None) -> dict:
    payload = await run_stdio(
        command=sys.executable,
        args=[str(PROBE)],
        server_id="probe",
        op="call",
        tool=tool,
        arguments=arguments or {},
        timeout=10,
    )
    return _parse(payload)


def test_build_child_env_is_constructed_from_allowlist(monkeypatch):
    for key, value in POISON.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("PYTHONPATH", str(ROOT))
    env = build_child_env("probe", server_data_dir("probe"), "tools")
    assert set(env) <= ALLOWED_ENV
    assert "PYTHONPATH" not in env
    leaked = set(env) & set(POISON)
    assert not leaked


async def test_subprocess_environment_does_not_inherit_secrets(monkeypatch):
    for key, value in POISON.items():
        monkeypatch.setenv(key, value)
    keys = set((await _call("report_env"))["keys"])
    leaked = keys & set(POISON)
    assert not leaked, f"the MCP child inherited {sorted(leaked)} from the parent process"
    assert "PYTHONPATH" not in keys


async def test_subprocess_cwd_is_a_dedicated_temp_dir():
    cwd = Path((await _call("report_cwd"))["cwd"]).resolve()
    assert cwd != REPO_ROOT and REPO_ROOT not in cwd.parents
    tmp = Path(tempfile.gettempdir()).resolve()
    assert tmp == cwd or tmp in cwd.parents
    assert not list(cwd.glob("**/*.db"))


async def test_child_cannot_reach_the_app_secret_or_database():
    result = await _call("try_read", {"path": "config/config.yml"})
    db = await _call("try_read", {"path": "aigoat.db"})
    assert result["ok"] is False
    assert db["ok"] is False
    assert "secret_key" not in json.dumps(result)


async def test_server_process_is_reaped_on_teardown():
    payload = await run_stdio(
        command=sys.executable,
        args=[str(PROBE)],
        server_id="probe",
        op="call",
        tool="report_pid",
        arguments={},
        timeout=10,
    )
    pid = _parse(payload)["pid"]
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


async def test_unknown_server_id_is_not_found():
    with pytest.raises(NotFoundError):
        get_server_spec("not-a-server")
    with pytest.raises(McpSpawnError):
        await run_stdio(
            command=sys.executable,
            args=["/nonexistent/mcp_server.py"],
            server_id="missing",
            op="discover",
            timeout=2,
        )
