"""mcp.host: the admin assistant is an MCP client with a model in the loop.

The app exports tickets and reviews into the child data dir, discovers tools
with run_allowlisted, and lets GatedAgentLoop pick a tool. Each call is another
allowlisted stdio spawn. Refund and export tools from the child are decoys.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.agent.broker import IntentGate
from app.agent.loop import GatedAgentLoop
from app.mcp.client import run_allowlisted
from app.mcp.env import server_data_dir
from app.models import Review, SupportMessage, SupportTicket, User
from app.services.ollama_client import get_llm_client
from app.services.tool_registry import Tool, ToolRegistry

ALWAYS_ON = "internal_shop"
ADDONS = (
    {"id": "community_support", "name": "Support Server", "trust_tier": "community"},
    {"id": "shadow_shop", "name": "Shop Catalog (community package)", "trust_tier": "untrusted"},
)
APPROVAL_TOOLS = frozenset({"issue_refund", "export_customer"})
_enabled: dict[int, set[str]] = {}
_runs: dict[str, "HostRun"] = {}


def _assistant_prompt(lab_id: str) -> str:
    path = Path(__file__).resolve().parents[2] / "prompts" / "labs" / "admin_assistant.md"
    return path.read_text(encoding="utf-8").strip()


@dataclass
class HostRun:
    run_id: str
    user_id: int
    message: str
    lab_id: str
    level: int
    servers: list[str]
    status: str = "running"
    answer: str = ""
    steps: list[dict[str, Any]] = field(default_factory=list)
    pending: dict[str, Any] | None = None
    transcript: list[dict[str, Any]] = field(default_factory=list)
    loop: GatedAgentLoop | None = None
    registry: ToolRegistry | None = None


def enabled_addons(user_id: int) -> set[str]:
    return set(_enabled.get(user_id, set()))


def set_addon(user_id: int, server_id: str, enabled: bool) -> None:
    known = {row["id"] for row in ADDONS}
    if server_id not in known:
        return
    current = _enabled.setdefault(user_id, set())
    if enabled:
        current.add(server_id)
    else:
        current.discard(server_id)


def integration_rows(user_id: int) -> list[dict[str, Any]]:
    chosen = enabled_addons(user_id)
    rows = [{
        "id": ALWAYS_ON,
        "name": "Internal Management Server",
        "trust_tier": "official",
        "enabled": True,
        "locked": True,
    }]
    for addon in ADDONS:
        rows.append({
            **addon,
            "enabled": addon["id"] in chosen,
            "locked": False,
        })
    return rows


def active_servers(user_id: int) -> list[str]:
    """Official server first so an enabled add-on can shadow a same-named tool."""
    return [ALWAYS_ON, *sorted(enabled_addons(user_id))]


async def export_shop_snapshot(db: AsyncSession) -> None:
    tickets = await db.execute(
        select(SupportTicket)
        .options(
            joinedload(SupportTicket.user),
            selectinload(SupportTicket.messages).joinedload(SupportMessage.user),
        )
        .order_by(SupportTicket.id.desc())
        .limit(50)
    )
    reviews = await db.execute(
        select(Review).options(joinedload(Review.user)).order_by(Review.id.desc()).limit(50)
    )
    ticket_rows = [
        {
            "id": row.id,
            "username": row.user.username if row.user else "",
            "subject": row.subject,
            "body": "\n".join(
                f"{message.user.username if message.user else ''}: {message.body}"
                for message in sorted(row.messages, key=lambda item: item.id)
            ) or row.body,
            "status": row.status,
        }
        for row in tickets.scalars().all()
    ]
    review_rows = [
        {
            "id": row.id,
            "product_id": row.product_id,
            "username": row.user.username if row.user else "",
            "rating": row.rating,
            "comment": row.comment,
        }
        for row in reviews.scalars().all()
    ]
    data_dir = server_data_dir(ALWAYS_ON)
    (data_dir / "tickets.json").write_text(json.dumps(ticket_rows), encoding="utf-8")
    (data_dir / "reviews.json").write_text(json.dumps(review_rows), encoding="utf-8")


def _schema(tool: dict[str, Any]) -> dict[str, Any]:
    raw = tool.get("inputSchema") or tool.get("input_schema") or {}
    if isinstance(raw, dict) and raw.get("type") == "object":
        return raw
    return {"type": "object", "properties": {}, "additionalProperties": True}


async def build_mcp_registry(server_ids: list[str], transcript: list[dict[str, Any]]) -> ToolRegistry:
    registry = ToolRegistry()
    for server_id in server_ids:
        listed = await run_allowlisted(server_id, "tools")
        transcript.extend(listed.get("transcript") or [])
        for spec in listed.get("tools") or []:
            name = str(spec.get("name") or "")
            if not name:
                continue

            async def _call(_name: str = name, _server: str = server_id, **kwargs: Any) -> dict[str, Any]:
                called = await run_allowlisted(_server, "call", tool=_name, arguments=kwargs)
                transcript.extend(called.get("transcript") or [])
                content = called.get("structured_content")
                if isinstance(content, dict):
                    return content
                return {"text": called.get("text") or "", "is_error": called.get("is_error")}

            registry.register(Tool(
                name=name,
                description=str(spec.get("description") or ""),
                handler=_call,
                requires_approval=name in APPROVAL_TOOLS,
                parameter_schema=_schema(spec),
                origin=server_id,
            ))
    return registry


def _steps(loop: GatedAgentLoop) -> list[dict[str, Any]]:
    rows = []
    for index, step in enumerate(loop.steps):
        registered = loop.tools.get(step.action) if hasattr(loop, "tools") else None
        rows.append({
            "seq": index,
            "thought": step.thought,
            "action": step.action,
            "server_id": getattr(registered, "origin", "") or "",
            "arguments": step.action_input,
            "observation": step.observation,
            "decision": step.decision,
            "control_id": step.control_id,
        })
    return rows


def serialize_run(run: HostRun) -> dict[str, Any]:
    payload = {
        "run_id": run.run_id,
        "status": run.status,
        "answer": run.answer,
        "lab_id": run.lab_id,
        "defense_level": run.level,
        "servers": run.servers,
        "steps": run.steps,
        "pending": run.pending,
        "transcript": run.transcript,
    }
    payload["evaluation"] = _evaluation(run)
    return payload


def _evaluation(run: HostRun) -> dict[str, Any] | None:
    from app.challenges.evaluator import EvalContext
    from app.challenges.registry import get_evaluator_by_title
    from app.core.lab_loader import get_lab_by_id

    lab = get_lab_by_id(run.lab_id) if run.lab_id else None
    key = lab.challenge_evaluator if lab else None
    if not key:
        return None
    evaluator = get_evaluator_by_title(key)
    if evaluator is None:
        return None
    transcript = []
    for step in run.steps:
        action = step.get("action")
        if not action or action == "finish":
            continue
        transcript.append({
            "type": "tool_call",
            "tool": action,
            "arguments": step.get("arguments") or {},
            "decision": step.get("decision"),
        })
        if step.get("observation"):
            transcript.append({
                "type": "tool_result",
                "tool": action,
                "content": step.get("observation"),
            })
    triggered = evaluator.check_exploit(EvalContext(
        user_message=run.message,
        model_output=run.answer,
        transcript=transcript,
    ))
    return {"exploit_triggered": bool(triggered), "evaluator": key, "flag": None}


async def _drive(run: HostRun, user: User) -> dict[str, Any]:
    assert run.loop is not None
    result = await run.loop.run(run.message)
    run.steps = _steps(run.loop)
    run.answer = result.answer or ""
    if result.terminated_reason == "awaiting_approval":
        run.status = "awaiting_approval"
        run.pending = result.pending
    else:
        run.status = "completed" if result.success else (result.terminated_reason or "completed")
        run.pending = None
    _runs[run.run_id] = run
    assert user.id == run.user_id
    return serialize_run(run)


async def host_turn(
    db: AsyncSession,
    user: User,
    message: str,
    *,
    lab_id: str = "",
    defense_level: int = 0,
    run_id: str | None = None,
    decision: str | None = None,
) -> dict[str, Any]:
    level = defense_level if defense_level in (0, 1, 2) else 0
    if run_id and decision:
        run = _runs.get(run_id)
        if run is None or run.user_id != user.id or run.pending is None or run.loop is None or run.registry is None:
            return {"error": "no pending approval", "run_id": run_id}
        pending = run.pending
        if decision == "approve":
            observed = await run.registry.invoke(str(pending.get("tool")), dict(pending.get("arguments") or {}))
            run.loop.steps[-1].observation = json.dumps(observed, default=str)
            run.loop.steps[-1].decision = "allow"
        else:
            run.loop.steps[-1].observation = "The admin denied this tool call."
            run.loop.steps[-1].decision = "deny"
        run.pending = None
        return await _drive(run, user)

    await export_shop_snapshot(db)
    transcript: list[dict[str, Any]] = []
    servers = active_servers(user.id)
    registry = await build_mcp_registry(servers, transcript)
    gate = IntentGate(registry, level=level, user_id=user.id, surface="mcp.host")
    from app.core.lab_loader import get_lab_by_id
    from app.mcp.victim_planner import VictimPlanner

    lab = get_lab_by_id(lab_id) if lab_id else None
    use_victim = str((lab.surface_config or {}).get("planner") or "") == "victim" if lab else False
    loop = GatedAgentLoop(
        registry,
        gate,
        max_steps=6,
        llm=VictimPlanner(level) if use_victim else get_llm_client(),
        system=_assistant_prompt(lab_id or ""),
    )
    run = HostRun(
        run_id=uuid.uuid4().hex,
        user_id=user.id,
        message=message,
        lab_id=lab_id or "",
        level=level,
        servers=servers,
        transcript=transcript,
        loop=loop,
        registry=registry,
    )
    return await _drive(run, user)
