"""MCP client API. Per-request stdio spawn; no connect/disconnect session."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.mcp.service import execute_mcp, list_servers
from app.models import User
from app.schemas.mcp import McpToolCallIn

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/servers")
async def get_servers(user: Annotated[User, Depends(get_current_user)]) -> list[dict[str, Any]]:
    assert user
    return list_servers()


@router.get("/servers/{server_id}/discover")
async def discover_server(
    server_id: str,
    user: Annotated[User, Depends(get_current_user)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    return await execute_mcp(
        user=user,
        lab_id=lab_id,
        data={"action": "discover", "server_id": server_id, "defense_level": defense_level},
    )


@router.get("/servers/{server_id}/tools")
async def list_tools(
    server_id: str,
    user: Annotated[User, Depends(get_current_user)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    return await execute_mcp(
        user=user,
        lab_id=lab_id,
        data={"action": "tools", "server_id": server_id, "defense_level": defense_level},
    )


@router.post("/servers/{server_id}/tools/{tool}/call")
async def call_tool(
    server_id: str,
    tool: str,
    body: McpToolCallIn,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    return await execute_mcp(
        user=user,
        lab_id=body.lab_id,
        data={
            "action": "call",
            "server_id": server_id,
            "tool": tool,
            "arguments": body.arguments,
            "defense_level": body.defense_level,
            "tool_description": body.tool_description,
        },
    )
