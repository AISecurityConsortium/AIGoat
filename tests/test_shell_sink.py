"""Integration tests for the ASI05 Docker sink.

These need a running Docker daemon with the sink image present. They are
skipped anywhere else, so CI without Docker still passes.
"""
from __future__ import annotations

import shutil
import subprocess

import pytest

from app.services.shell_sink import IMAGE, run_in_sandbox


def _docker_ready() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        subprocess.run(["docker", "info"], capture_output=True, timeout=10, check=True)
        subprocess.run(
            ["docker", "image", "inspect", IMAGE], capture_output=True, timeout=10, check=True
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return True


requires_docker = pytest.mark.skipif(
    not _docker_ready(), reason=f"docker daemon or image {IMAGE} unavailable"
)


async def test_empty_command_is_refused_without_docker():
    result = await run_in_sandbox("   ")
    assert result["refused"] is True


@requires_docker
async def test_command_really_executes_in_a_container():
    result = await run_in_sandbox("id")
    assert result["executed"] is True
    assert result["exit_code"] == 0
    assert "uid=" in result["stdout"]


@requires_docker
async def test_container_is_not_the_host():
    result = await run_in_sandbox("hostname")
    assert result["executed"] is True
    host = subprocess.run(["hostname"], capture_output=True, text=True).stdout.strip()
    assert result["stdout"].strip() != host


@requires_docker
async def test_failing_command_reports_its_exit_code():
    result = await run_in_sandbox("exit 3")
    assert result["executed"] is True
    assert result["exit_code"] == 3


@requires_docker
async def test_network_is_disabled():
    result = await run_in_sandbox("wget -T 2 -q -O /tmp/out http://example.com")
    # either wget fails fast with a non-zero exit, or the sink times it out;
    # both prove the container could not reach the network
    if result.get("executed"):
        assert result["exit_code"] != 0
    else:
        assert result["refused"] is True


@requires_docker
async def test_long_running_command_times_out_and_is_destroyed():
    result = await run_in_sandbox("sleep 60")
    assert result["refused"] is True
    assert "timed out" in result["reason"]
    left = subprocess.run(
        ["docker", "ps", "-a", "--filter", "name=aigoat-asi05", "-q"],
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert left == ""
