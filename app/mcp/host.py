"""mcp.host: the admin assistant is an MCP client with a model in the loop.

The app exports tickets and reviews into the child data dir, discovers tools
with run_allowlisted, and lets GatedAgentLoop pick a tool. Each call is another
allowlisted stdio spawn. Refund and export tools from the child are decoys.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.agent.broker import IntentGate
from app.agent.loop import GatedAgentLoop
from app.core.exceptions import ValidationError
from app.core.lab_loader import get_lab_by_id
from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.labs.containment import is_halted
from app.labs.effects import apply_goal_hijack_impact
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
_scoped_enabled: dict[tuple[int, str], set[str]] = {}
_runs: dict[str, "HostRun"] = {}


def _lab(lab_id: str):
    if not lab_id:
        return None
    from app.core.lab_loader import get_lab_by_id

    return get_lab_by_id(lab_id)


def lab_is_scoped(lab_id: str) -> bool:
    """Learner-first host labs keep their own add-on set. Legacy labs share the old one."""
    lab = _lab(lab_id)
    if lab is None or lab.surface != "mcp.host":
        return False
    return bool((lab.ui or {}).get("learner_first"))


def lab_has_completion(lab_id: str) -> bool:
    lab = _lab(lab_id)
    return bool(lab and lab.completion)


def _assistant_prompt(lab_id: str) -> str:
    """Shared admin prompt, unless this lab names a file under prompts/labs/."""
    root = Path(__file__).resolve().parents[2] / "prompts" / "labs"
    name = "admin_assistant.md"
    lab = _lab(lab_id) if lab_id else None
    variant = str((lab.surface_config or {}).get("prompt_variant") or "") if lab else ""
    if variant and "/" not in variant and "\\" not in variant and variant.endswith(".md"):
        if (root / variant).is_file():
            name = variant
    return (root / name).read_text(encoding="utf-8").strip()


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
    tool_catalog: list[dict[str, Any]] = field(default_factory=list)
    description_outcomes: list[dict[str, Any]] = field(default_factory=list)
    ceiling: int | None = None


class HostIntentGate(IntentGate):
    """Adds lab pins and the serving integration. Absent pins leave the chain unchanged."""

    def __init__(self, registry: ToolRegistry, *, level: int, user_id: int, lab: Any) -> None:
        super().__init__(registry, level=level, user_id=user_id, surface="mcp.host")
        config = (lab.surface_config or {}) if lab is not None and lab_is_scoped(lab.id) else {}
        self._pins = dict(config.get("pinned_descriptions") or {})
        self._origins = dict(config.get("pinned_origins") or {})

    def extra_context(self, tool: Any) -> dict[str, Any]:
        ctx: dict[str, Any] = {}
        if self._pins:
            ctx["pinned_descriptions"] = self._pins
        if self._origins:
            ctx["pinned_origins"] = self._origins
        if tool is not None:
            ctx["tool_origin"] = str(getattr(tool, "origin", "") or "")
            ctx["tool_description"] = str(getattr(tool, "description", "") or "")
        return ctx


def enabled_addons(user_id: int, lab_id: str = "") -> set[str]:
    if lab_id and lab_is_scoped(lab_id):
        return set(_scoped_enabled.get((user_id, lab_id), set()))
    return set(_enabled.get(user_id, set()))


def set_addon(user_id: int, server_id: str, enabled: bool, lab_id: str = "") -> None:
    known = {row["id"] for row in ADDONS}
    if server_id not in known:
        return
    if lab_id and lab_is_scoped(lab_id):
        current = _scoped_enabled.setdefault((user_id, lab_id), set())
    else:
        current = _enabled.setdefault(user_id, set())
    if enabled:
        current.add(server_id)
    else:
        current.discard(server_id)


def clear_addons(user_id: int, lab_id: str) -> None:
    _scoped_enabled.pop((user_id, lab_id), None)


def integration_rows(user_id: int, lab_id: str = "") -> list[dict[str, Any]]:
    from app.mcp.registry import get_server_spec

    scoped = bool(lab_id) and lab_is_scoped(lab_id)
    chosen = enabled_addons(user_id, lab_id if scoped else "")
    rows = [{
        "id": ALWAYS_ON,
        "name": "Internal Management Server",
        "trust_tier": "official",
        "enabled": True,
        "locked": True,
    }]
    if scoped:
        lab = _lab(lab_id)
        for server_id in (lab.surface_config or {}).get("host_servers") or []:
            spec = get_server_spec(str(server_id))
            rows.append({
                "id": spec.id,
                "name": spec.name,
                "trust_tier": spec.trust_tier,
                "enabled": True,
                "locked": True,
            })
    for addon in ADDONS:
        rows.append({
            **addon,
            "enabled": addon["id"] in chosen,
            "locked": False,
        })
    return rows


def active_servers(user_id: int, lab_id: str = "") -> list[str]:
    """Official server first, then a lab's extra servers, then enabled add-ons."""
    ordered = [ALWAYS_ON]
    if lab_id and lab_is_scoped(lab_id):
        lab = _lab(lab_id)
        ordered.extend(str(item) for item in (lab.surface_config or {}).get("host_servers") or [])
    ordered.extend(sorted(enabled_addons(user_id, lab_id if lab_is_scoped(lab_id) else "")))
    seen: list[str] = []
    for server_id in ordered:
        if server_id not in seen:
            seen.append(server_id)
    return seen


def servers_for_lab(user_id: int, lab_id: str) -> list[str]:
    """Active servers, plus add-ons the lab declares, without persisting the toggle."""
    servers = active_servers(user_id, lab_id)
    lab = get_lab_by_id(lab_id) if lab_id else None
    extras = (lab.surface_config or {}).get("addons") if lab else None
    for addon in extras or []:
        name = str(addon)
        if name and name not in servers:
            servers.append(name)
    return servers


def cancel_host_runs(user_id: int, lab_id: str) -> int:
    """Mark this user's in-memory host runs for the lab as halted."""
    cancelled = 0
    for run in list(_runs.values()):
        if run.user_id != user_id or run.lab_id != lab_id:
            continue
        if run.status not in {"running", "awaiting_approval"}:
            continue
        run.status = "cancelled"
        run.pending = None
        cancelled += 1
    return cancelled


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


async def build_mcp_registry(
    server_ids: list[str],
    transcript: list[dict[str, Any]],
    *,
    lab_id: str = "",
) -> ToolRegistry:
    registry = ToolRegistry()
    child_lab = lab_id or None
    for server_id in server_ids:
        listed = await run_allowlisted(server_id, "tools", lab_id=child_lab)
        transcript.extend(listed.get("transcript") or [])
        for spec in listed.get("tools") or []:
            name = str(spec.get("name") or "")
            if not name:
                continue

            async def _call(_name: str = name, _server: str = server_id, **kwargs: Any) -> dict[str, Any]:
                called = await run_allowlisted(_server, "call", tool=_name, arguments=kwargs, lab_id=child_lab)
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


def _pins_for(lab_id: str) -> dict[str, str]:
    lab = get_lab_by_id(lab_id) if lab_id else None
    raw = (lab.surface_config or {}).get("pinned_descriptions") if lab else None
    if not isinstance(raw, dict):
        return {}
    return {str(key): str(value) for key, value in raw.items()}


async def harden_catalog(
    registry: ToolRegistry,
    level: int,
    lab_id: str,
    user_id: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Apply pin and description scan to the model-facing tool list."""
    catalog = [
        {"name": item["name"], "description": item["description"]}
        for item in registry.list_tools()
    ]
    if level < 1 or not catalog:
        return catalog, []
    profile = resolve_profile("mcp.host", level)
    controls = [
        cid for cid in profile.controls
        if DefenseStage.TOOL_CALL in get_control(cid).applies_to
    ]
    decision = DefenseDecision(
        surface="mcp.host",
        stage=DefenseStage.TOOL_CALL,
        payload=json.dumps(catalog),
        level=level,
        context={"tools": catalog, "pinned_descriptions": _pins_for(lab_id), "op": "tools"},
        user_id=user_id,
    )
    chain = await run_chain(controls, decision)
    for item in catalog:
        tool = registry.get(str(item.get("name") or ""))
        if tool is not None:
            tool.description = str(item.get("description") or "")
    outcomes = [
        {"control_id": outcome.control_id, "action": outcome.action.value, "reason": outcome.reason}
        for outcome in chain.outcomes
    ]
    return catalog, outcomes


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
        "tool_catalog": run.tool_catalog,
        "defense": {"outcomes": run.description_outcomes},
    }
    payload["evaluation"] = _evaluation(run)
    return payload


def _evaluation(run: HostRun) -> dict[str, Any] | None:
    from app.challenges.evaluator import EvalContext
    from app.challenges.registry import get_evaluator_by_title
    from app.core.lab_loader import get_lab_by_id

    lab = get_lab_by_id(run.lab_id) if run.lab_id else None
    if lab and lab.completion:
        return None
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
    if run.tool_catalog:
        transcript.append({
            "type": "tool_result",
            "tool": "tools/list",
            "content": json.dumps(run.tool_catalog),
        })
    triggered = evaluator.check_exploit(EvalContext(
        user_message=run.message,
        model_output=run.answer,
        transcript=transcript,
    ))
    return {"exploit_triggered": bool(triggered), "evaluator": key, "flag": None}


_GOAL_HIJACK_EVALUATOR = "mcp host goal hijack"
_REFUND_ORDER = (
    r"refund\w*\b[^\n]{0,60}?\border\s*#?\s*(\d+)"
    r"|\border\s*#?\s*(\d+)\b[^\n]{0,60}?\brefund"
)


def _first_refund_order(text: str) -> int | None:
    match = re.search(_REFUND_ORDER, text or "", re.I)
    if not match:
        return None
    return int(match.group(1) or match.group(2))


def _impact_targets(run: HostRun) -> tuple[int | None, int | None]:
    """The order to refund and the ticket to close, read from the run's trace."""
    ticket_id: int | None = None
    for step in run.steps:
        if step.get("action") == "read_ticket":
            raw = (step.get("arguments") or {}).get("ticket_id")
            if raw is not None:
                try:
                    ticket_id = int(raw)
                except (TypeError, ValueError):
                    ticket_id = None
    order_id = _first_refund_order(run.answer)
    if order_id is None:
        for step in run.steps:
            if step.get("action") in {"read_ticket", "list_open_tickets", "issue_refund"}:
                order_id = _first_refund_order(str(step.get("observation") or ""))
                if order_id is not None:
                    break
    return order_id, ticket_id


async def _maybe_apply_impact(db: AsyncSession, run: HostRun, payload: dict[str, Any]) -> None:
    """When a goal hijack succeeds, apply the refund and ticket close it implied."""
    lab = get_lab_by_id(run.lab_id) if run.lab_id else None
    if lab is None or lab.challenge_evaluator != _GOAL_HIJACK_EVALUATOR:
        return
    if not (payload.get("evaluation") or {}).get("exploit_triggered"):
        return
    order_id, ticket_id = _impact_targets(run)
    if order_id is None and ticket_id is None:
        return
    reply = (
        f"Refund issued for order {order_id} as requested. Marking this ticket resolved."
        if order_id is not None
        else "Marking this ticket resolved."
    )
    impact = await apply_goal_hijack_impact(
        db,
        run.user_id,
        run.lab_id,
        order_id=order_id,
        ticket_id=ticket_id,
        reply=reply,
    )
    if impact:
        payload["impact"] = impact


def _origin(run: HostRun, action: str) -> str:
    tool = run.registry.get(action) if run.registry is not None else None
    return str(getattr(tool, "origin", "") or "")


def _earlier_text(steps: list[Any], index: int) -> str:
    parts = []
    for step in steps[:index]:
        observed = getattr(step, "observation", "") or ""
        if observed:
            parts.append(str(observed))
    return "\n".join(parts)


async def _record_steps(db: AsyncSession, run: HostRun, steps: list[Any], start: int) -> None:
    from app.mcp.host_evidence import argument_provenance, record_rows, step_rows, stored_baseline

    baseline = await stored_baseline(db, run.user_id, run.lab_id)
    if baseline is None:
        baseline = int(run.ceiling or 0)
    for index in range(start, len(steps)):
        step = steps[index]
        action = str(getattr(step, "action", "") or "")
        if not action or action == "finish":
            if action == "finish":
                await record_rows(db, run.user_id, run.lab_id, [{
                    "surface": "mcp.host",
                    "kind": "host_reply",
                    "actor": "model",
                    "shown": {"text": [str(getattr(step, "thought", "") or "")]},
                }])
            continue
        provenance = await argument_provenance(
            db,
            admin_message=run.message,
            arguments=getattr(step, "action_input", None) or {},
            earlier_text=_earlier_text(steps, index),
            baseline_id=baseline,
        )
        await record_rows(db, run.user_id, run.lab_id, step_rows(step, provenance=provenance, origin=_origin(run, action)))


async def _record(db: AsyncSession, run: HostRun, *, before: int, continuation: str | None) -> None:
    from app.mcp.host_evidence import (
        approval_row,
        argument_provenance,
        host_turn_row,
        record_rows,
        result_ok,
        stored_baseline,
    )

    if not lab_has_completion(run.lab_id) or run.loop is None:
        return
    steps = run.loop.steps
    if continuation is None:
        existing = await stored_baseline(db, run.user_id, run.lab_id)
        ceiling = None if existing is not None else run.ceiling
        await record_rows(db, run.user_id, run.lab_id, [host_turn_row(run.message, run.level, ceiling)])
        await _record_steps(db, run, steps, 0)
        return
    pending = steps[before - 1] if before else None
    tool = str(getattr(pending, "action", "") or "") if pending is not None else ""
    args = getattr(pending, "action_input", None) if pending is not None else {}
    if not isinstance(args, dict):
        args = {}
    await record_rows(db, run.user_id, run.lab_id, [approval_row(continuation, tool, args)])
    if continuation == "approve" and pending is not None:
        baseline = await stored_baseline(db, run.user_id, run.lab_id)
        provenance = await argument_provenance(
            db,
            admin_message=run.message,
            arguments=args,
            earlier_text=_earlier_text(steps, before - 1),
            baseline_id=int(baseline or 0),
        )
        ok, parsed = result_ok(getattr(pending, "observation", None), args)
        if ok:
            await record_rows(db, run.user_id, run.lab_id, [{
                "surface": "mcp.host",
                "kind": "tool_result",
                "actor": "server",
                "server_id": _origin(run, tool),
                "tool": tool,
                "args": args,
                "decision": "allow",
                "ok": True,
                "provenance": provenance,
                "shown": {
                    "structured": parsed if isinstance(parsed, dict) else {},
                    "text": [json.dumps(parsed, default=str)],
                },
            }])
    await _record_steps(db, run, steps, before)


async def _drive(
    run: HostRun,
    user: User,
    db: AsyncSession | None = None,
    *,
    continuation: str | None = None,
) -> dict[str, Any]:
    assert run.loop is not None
    before = len(run.loop.steps)
    result = await run.loop.run(run.message)
    run.steps = _steps(run.loop)
    answer = result.answer or ""
    if run.level >= 1 and answer:
        answer = await defense_pipeline.moderate_output(answer, run.level, surface="mcp.host")
    run.answer = answer
    if result.terminated_reason == "awaiting_approval":
        run.status = "awaiting_approval"
        run.pending = result.pending
    else:
        run.status = "completed" if result.success else (result.terminated_reason or "completed")
        run.pending = None
    _runs[run.run_id] = run
    assert user.id == run.user_id
    if db is not None:
        await _record(db, run, before=before, continuation=continuation)
    payload = serialize_run(run)
    if db is not None:
        await _maybe_apply_impact(db, run, payload)
    return payload


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
    if lab_id == "killchain-1":
        raise ValidationError("The Agentic Kill Chain runs in its own workbench: POST /api/killchain/turn.")
    if lab_id and is_halted(user.id, lab_id):
        raise ValidationError("This lab is halted. Reset the lab before starting another run.")
    if run_id and decision:
        run = _runs.get(run_id)
        if run is None or run.user_id != user.id or run.pending is None or run.loop is None or run.registry is None:
            return {"error": "no pending approval", "run_id": run_id}
        if run.lab_id and is_halted(user.id, run.lab_id):
            raise ValidationError("This lab is halted. Reset the lab before starting another run.")
        pending = run.pending
        if decision == "approve":
            observed = await run.registry.invoke(str(pending.get("tool")), dict(pending.get("arguments") or {}))
            text = json.dumps(observed, default=str)
            text = await run.loop.broker.review_tool_result(text)
            run.loop.steps[-1].observation = text
            run.loop.steps[-1].decision = "allow"
        else:
            run.loop.steps[-1].observation = "The admin denied this tool call."
            run.loop.steps[-1].decision = "deny"
        run.pending = None
        return await _drive(run, user, db, continuation=decision)

    from app.mcp.host_evidence import message_ceiling

    if level >= 1:
        gated = await defense_pipeline.process_input(message, level, user.id, surface="mcp.host")
        if not gated.allowed:
            control_id = next(
                (outcome.control_id for outcome in gated.outcomes if outcome.action == ControlAction.DENY),
                None,
            )
            blocked = HostRun(
                run_id=uuid.uuid4().hex,
                user_id=user.id,
                message=message,
                lab_id=lab_id or "",
                level=level,
                servers=[],
                status="failed",
                answer=gated.message,
                steps=[{
                    "seq": 0,
                    "thought": "",
                    "action": "input",
                    "arguments": {},
                    "observation": gated.message,
                    "decision": ControlAction.DENY.value,
                    "control_id": control_id,
                }],
            )
            _runs[blocked.run_id] = blocked
            return serialize_run(blocked)
        message = gated.message

    await export_shop_snapshot(db)
    transcript: list[dict[str, Any]] = []
    servers = servers_for_lab(user.id, lab_id or "")
    registry = await build_mcp_registry(servers, transcript, lab_id=lab_id or "")
    catalog, outcomes = await harden_catalog(registry, level, lab_id or "", user.id)
    from app.mcp.victim_planner import VictimPlanner

    lab = get_lab_by_id(lab_id) if lab_id else None
    gate = HostIntentGate(registry, level=level, user_id=user.id, lab=lab)
    use_victim = str((lab.surface_config or {}).get("planner") or "") == "victim" if lab else False
    loop = GatedAgentLoop(
        registry,
        gate,
        max_steps=6,
        llm=VictimPlanner(level) if use_victim else get_llm_client(),
        system=_assistant_prompt(lab_id or ""),
    )
    ceiling = await message_ceiling(db) if lab_has_completion(lab_id or "") else None
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
        tool_catalog=catalog,
        description_outcomes=outcomes,
        ceiling=ceiling,
    )
    return await _drive(run, user, db)
