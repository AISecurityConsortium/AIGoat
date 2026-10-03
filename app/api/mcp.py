"""MCP client API. Per-request stdio spawn; no connect/disconnect session."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.dependencies import require_admin as _require_admin
from app.mcp.host import host_turn, integration_rows, set_addon
from app.mcp.progress import record_lab_result
from app.mcp.service import execute_mcp, list_servers
from app.models import User
from app.schemas.mcp import McpHostIntegrationIn, McpHostTurnIn, McpToolCallIn

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/servers")
async def get_servers(user: Annotated[User, Depends(get_current_user)]) -> list[dict[str, Any]]:
    rows = list_servers()
    if not user.is_staff:
        rows = [row for row in rows if row.get("id") != "internal_shop"]
    return rows


@router.get("/servers/{server_id}/discover")
async def discover_server(
    server_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    payload = await execute_mcp(
        user=user,
        lab_id=lab_id,
        data={"action": "discover", "server_id": server_id, "defense_level": defense_level},
        db=db,
    )
    await record_lab_result(db, user, lab_id, payload.get("evaluation"))
    return payload


@router.get("/servers/{server_id}/tools")
async def list_tools(
    server_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    payload = await execute_mcp(
        user=user,
        lab_id=lab_id,
        data={"action": "tools", "server_id": server_id, "defense_level": defense_level},
        db=db,
    )
    await record_lab_result(db, user, lab_id, payload.get("evaluation"))
    return payload


@router.post("/servers/{server_id}/tools/{tool}/call")
async def call_tool(
    server_id: str,
    tool: str,
    body: McpToolCallIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    payload = await execute_mcp(
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
        db=db,
    )
    await record_lab_result(db, user, body.lab_id, payload.get("evaluation"))
    return payload


@router.get("/host/integrations")
async def host_integrations(user: Annotated[User, Depends(get_current_user)]) -> list[dict[str, Any]]:
    _require_admin(user)
    return integration_rows(user.id)


@router.post("/host/integrations")
async def host_set_integration(
    body: McpHostIntegrationIn,
    user: Annotated[User, Depends(get_current_user)],
) -> list[dict[str, Any]]:
    _require_admin(user)
    set_addon(user.id, body.server_id, body.enabled)
    return integration_rows(user.id)


@router.post("/host/turn")
async def host_turn_route(
    body: McpHostTurnIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _require_admin(user)
    payload = await host_turn(
        db,
        user,
        body.message,
        lab_id=body.lab_id or "",
        defense_level=0 if body.defense_level is None else body.defense_level,
        run_id=body.run_id,
        decision=body.decision,
    )
    await record_lab_result(db, user, payload.get("lab_id"), payload.get("evaluation"))
    return payload
