"""Evidence rows for learner-first mcp.host labs.

Legacy host labs do not call this. Provenance is stored on the row and is not
part of the learner-visible projection.
"""
from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mcp.evidence import append_events, load_evidence
from app.models import SupportMessage, User

_SURFACE = "mcp.host"


def value_in_text(value: str, text: str) -> bool:
    """Digit-bounded for numbers, case-insensitive otherwise."""
    if not value or not text:
        return False
    if value.isdigit():
        return re.search(rf"(?<!\d){re.escape(value)}(?!\d)", text) is not None
    return value.casefold() in text.casefold()


async def message_ceiling(db: AsyncSession) -> int:
    from sqlalchemy import func

    found = await db.scalar(select(func.max(SupportMessage.id)))
    return int(found or 0)


async def stored_baseline(db: AsyncSession, user_id: int, lab_id: str) -> int | None:
    """The ceiling saved on the first completed admin turn of this attempt."""
    for event in await load_evidence(db, user_id, lab_id):
        if event.kind != "host_turn" or not isinstance(event.data, dict):
            continue
        if "max_message_id" in event.data:
            try:
                return int(event.data["max_message_id"])
            except (TypeError, ValueError):
                return None
    return None


async def argument_provenance(
    db: AsyncSession,
    *,
    admin_message: str,
    arguments: dict[str, Any],
    earlier_text: str,
    baseline_id: int,
) -> dict[str, Any]:
    """Where each argument value came from. Computed when the call is recorded."""
    rows = await db.execute(
        select(SupportMessage, User)
        .join(User, SupportMessage.user_id == User.id)
        .where(SupportMessage.id > int(baseline_id))
        .order_by(SupportMessage.id)
    )
    messages = [
        (message, user)
        for message, user in rows.all()
        if not user.is_staff and value_in_text(str(message.body or ""), earlier_text)
    ]
    args: dict[str, Any] = {}
    for key, raw in (arguments or {}).items():
        value = str(raw if raw is not None else "").strip()
        if value_in_text(value, admin_message or ""):
            args[str(key)] = {"source": "admin_message"}
            continue
        matched = None
        for message, user in messages:
            if value_in_text(value, str(message.body or "")):
                matched = (message, user)
                break
        if matched is None:
            args[str(key)] = {"source": "model"}
            continue
        message, user = matched
        ticket_id = int(message.ticket_id or 0)
        args[str(key)] = {
            "source": "shopper_message",
            "ticket_id": ticket_id,
            "author": user.username or "",
        }
    return {"args": args}


def result_ok(observation: Any, arguments: dict[str, Any]) -> tuple[bool, Any]:
    parsed: Any = observation
    if isinstance(observation, str):
        try:
            parsed = json.loads(observation)
        except json.JSONDecodeError:
            parsed = {"text": observation}
    if not isinstance(parsed, dict):
        return False, parsed
    if parsed.get("error") or parsed.get("status") == "awaiting_approval":
        return False, parsed
    if parsed.get("ok") is False or parsed.get("is_error") is True:
        return False, parsed
    sku = arguments.get("sku") if isinstance(arguments, dict) else None
    if "sku" in (arguments or {}) and not str(sku or "").strip():
        return False, parsed
    return True, parsed


def step_rows(
    step: Any,
    *,
    provenance: dict[str, Any],
    origin: str = "",
) -> list[dict[str, Any]]:
    """tool_call plus a result or a control decision. parent_index is within this batch."""
    action = str(getattr(step, "action", "") or "")
    arguments = getattr(step, "action_input", None) or {}
    if not isinstance(arguments, dict):
        arguments = {}
    decision = str(getattr(step, "decision", "") or "")
    ok, parsed = result_ok(getattr(step, "observation", None), arguments)
    call = {
        "surface": _SURFACE,
        "kind": "tool_call",
        "actor": "model",
        "server_id": origin or str(getattr(step, "server_id", "") or ""),
        "tool": action,
        "args": arguments,
        "decision": decision,
        "ok": bool(ok) if decision == "allow" else False,
        "control_id": str(getattr(step, "control_id", "") or ""),
        "provenance": provenance,
    }
    rows = [call]
    if decision == "allow" and ok:
        rows.append({
            "surface": _SURFACE,
            "kind": "tool_result",
            "actor": "server",
            "server_id": origin,
            "tool": action,
            "args": arguments,
            "decision": "allow",
            "ok": True,
            "provenance": provenance,
            "shown": {"structured": parsed if isinstance(parsed, dict) else {}, "text": [json.dumps(parsed, default=str)]},
            "parent_index": 0,
        })
    elif decision in {"deny", "require_approval"}:
        reason = "Paused for approval." if decision == "require_approval" else ""
        if decision == "deny" and isinstance(parsed, dict):
            reason = str(parsed.get("error") or "Call denied.")
        rows.append({
            "surface": _SURFACE,
            "kind": "control_decision",
            "actor": "control",
            "server_id": origin,
            "tool": action,
            "args": arguments,
            "decision": decision,
            "ok": False,
            "control_id": str(getattr(step, "control_id", "") or ""),
            "provenance": provenance,
            "data": {"reason": reason},
            "shown": {"text": [reason] if reason else []},
            "parent_index": 0,
        })
    return rows


async def record_rows(db: AsyncSession, user_id: int, lab_id: str, rows: list[dict[str, Any]]) -> None:
    if rows:
        await append_events(db, user_id, lab_id, rows)


def host_turn_row(message: str, level: int, ceiling: int | None) -> dict[str, Any]:
    data: dict[str, Any] = {"message": message, "level": level}
    if ceiling is not None:
        data["max_message_id"] = int(ceiling)
    return {
        "surface": _SURFACE,
        "kind": "host_turn",
        "actor": "learner",
        "data": data,
        "shown": {"text": [message]},
    }


def integration_row(server_id: str, enabled: bool) -> dict[str, Any]:
    return {
        "surface": _SURFACE,
        "kind": "integration_changed",
        "actor": "learner",
        "server_id": server_id,
        "decision": "enabled" if enabled else "disabled",
    }


def approval_row(decision: str, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "surface": _SURFACE,
        "kind": "approval_decision",
        "actor": "learner",
        "tool": tool,
        "args": arguments,
        "decision": decision,
    }
