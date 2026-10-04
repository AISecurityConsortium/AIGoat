"""Sandboxed shell sink for the ASI05 lab.

This module is the one intentional OS-layer sink in the project, which is
why it lives outside the guarded ``app/agent`` tree (see
tests/test_security_invariants.py). The command really executes, inside a
disposable Docker container with no network, a read-only root filesystem,
dropped capabilities, and tight memory, cpu, and pid limits. The container
is the security boundary, so the lab can show real command output without
giving the agent a host sink. If Docker is unavailable the sink refuses,
which keeps a machine without Docker safe by default.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

IMAGE = "alpine:3.20"
TIMEOUT_SECONDS = 5
MAX_OUTPUT_CHARS = 4000

_BASE_ARGV = [
    "docker",
    "run",
    "--rm",
    "--pull",
    "never",
    "--network",
    "none",
    "--memory",
    "64m",
    "--cpus",
    "0.5",
    "--pids-limit",
    "64",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
]


async def run_in_sandbox(command: str) -> dict[str, Any]:
    """Run ``command`` in a throwaway container and return its output.

    The argv list is passed to ``exec`` directly, so the command string is
    never re-parsed by a host shell. ``sh -c`` runs only inside the
    container.
    """
    command = (command or "").strip()
    if not command:
        return {"refused": True, "command": command, "reason": "empty command"}
    name = f"aigoat-asi05-{uuid.uuid4().hex[:12]}"
    argv = [*_BASE_ARGV, "--name", name, IMAGE, "sh", "-c", command]
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        return {"refused": True, "command": command, "reason": "docker is not installed"}
    except OSError as exc:
        return {"refused": True, "command": command, "reason": f"docker failed to start: {exc}"}
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=TIMEOUT_SECONDS)
    except TimeoutError:
        await _force_remove(name)
        return {
            "refused": True,
            "command": command,
            "reason": f"timed out after {TIMEOUT_SECONDS}s; the container was destroyed",
        }
    out = stdout.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
    err = stderr.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
    if proc.returncode == 125:
        # docker itself failed: daemon down or image missing
        reason = err.strip() or "docker run failed"
        return {"refused": True, "command": command, "reason": reason}
    return {
        "refused": False,
        "executed": True,
        "sandbox": "docker",
        "image": IMAGE,
        "command": command,
        "exit_code": proc.returncode,
        "stdout": out,
        "stderr": err,
    }


async def _force_remove(name: str) -> None:
    """Destroy a container whose command outlived the timeout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker",
            "rm",
            "-f",
            name,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=5)
    except (OSError, TimeoutError):
        pass
