"""Stdio MCP client: spawn, one RPC, reap. Lives outside T004-guarded trees."""
from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Any

from mcp import Client, StdioServerParameters
from mcp.types import Implementation, TextContent

from app.core.config import get_settings
from app.core.exceptions import McpSpawnError, ValidationError
from app.mcp.env import build_child_env, server_data_dir
from app.mcp.registry import get_server_spec

logger = logging.getLogger("app.mcp")

CLIENT_INFO = Implementation(name="aigoat", version="0.3.0")

_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(get_settings().mcp.max_concurrent)
    return _semaphore


def _dump(obj: Any) -> Any:
    if obj is None:
        return None
    dump = getattr(obj, "model_dump", None)
    if dump is not None:
        return dump(by_alias=True, exclude_none=True, mode="json")
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _dump(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_dump(item) for item in obj]
    return str(obj)


def _seed_cwd(tmp: str) -> None:
    Path(tmp, "notes.txt").write_text("DECOY_NOTE=not-a-real-secret\n", encoding="utf-8")


def _rpc(method: str, params: dict[str, Any], rpc_id: int) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params}


def _rpc_result(rpc_id: int, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rpc_id, "result": result}


def _text_blocks(result: Any) -> list[str]:
    texts: list[str] = []
    for block in getattr(result, "content", None) or ():
        if isinstance(block, TextContent):
            texts.append(block.text)
    return texts


async def run_stdio(
    *,
    command: str,
    args: list[str],
    server_id: str,
    op: str,
    tool: str | None = None,
    arguments: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> dict[str, Any]:
    """Launch a stdio server, run one operation, reap. Used by tests and production."""
    if op not in {"discover", "tools", "call"}:
        raise ValidationError(f"unknown MCP operation {op!r}")
    if op == "call" and not tool:
        raise ValidationError("tool is required for MCP call")
    settings = get_settings()
    limit = float(timeout if timeout is not None else settings.mcp.spawn_timeout)
    env = build_child_env(server_id, server_data_dir(server_id), op)
    logger.info("mcp spawn server_id=%s op=%s argv=%s", server_id, op, [command, *args])
    transcript: list[dict[str, Any]] = []
    payload: dict[str, Any] = {"server_id": server_id, "op": op}

    async with _get_semaphore():
        with tempfile.TemporaryDirectory(prefix="aigoat-mcp-") as tmp:
            _seed_cwd(tmp)
            params = StdioServerParameters(command=command, args=list(args), env=env, cwd=tmp)
            try:
                async with asyncio.timeout(limit):
                    async with Client(
                        params,
                        client_info=CLIENT_INFO,
                        read_timeout_seconds=limit,
                    ) as client:
                        discover = client.session.discover_result
                        discover_dump = _dump(discover) or {}
                        payload["protocol_version"] = client.protocol_version
                        payload["server_info"] = _dump(client.server_info)
                        payload["capabilities"] = _dump(client.server_capabilities)
                        payload["instructions"] = client.instructions
                        payload["supported_versions"] = discover_dump.get("supportedVersions") or discover_dump.get(
                            "supported_versions"
                        )
                        payload["discover"] = discover_dump
                        transcript.append(_rpc("server/discover", {}, 1))
                        transcript.append(_rpc_result(1, discover_dump))
                        if op == "tools":
                            listed = await client.list_tools()
                            tools = [_dump(item) for item in listed.tools]
                            payload["tools"] = tools
                            transcript.append(_rpc("tools/list", {}, 2))
                            transcript.append(_rpc_result(2, {"tools": tools}))
                        elif op == "call":
                            result = await client.call_tool(str(tool), arguments or {})
                            payload["tool"] = tool
                            payload["arguments"] = arguments or {}
                            payload["is_error"] = bool(result.is_error)
                            payload["structured_content"] = _dump(result.structured_content)
                            payload["text"] = _text_blocks(result)
                            transcript.append(_rpc("tools/call", {"name": tool, "arguments": arguments or {}}, 2))
                            transcript.append(_rpc_result(2, {
                                "isError": bool(result.is_error),
                                "structuredContent": payload["structured_content"],
                                "content": payload["text"],
                            }))
            except TimeoutError as exc:
                raise McpSpawnError(server_id, f"MCP server {server_id} timed out") from exc
            except McpSpawnError:
                raise
            except Exception as exc:
                raise McpSpawnError(
                    server_id,
                    f"MCP server {server_id} failed: {exc}",
                    status_code=502,
                ) from exc

    payload["transcript"] = transcript
    return payload


async def run_allowlisted(
    server_id: str,
    op: str,
    *,
    tool: str | None = None,
    arguments: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> dict[str, Any]:
    spec = get_server_spec(server_id)
    command, script = spec.command_display()
    return await run_stdio(
        command=command,
        args=[script],
        server_id=spec.id,
        op=op,
        tool=tool,
        arguments=arguments,
        timeout=timeout,
    )
