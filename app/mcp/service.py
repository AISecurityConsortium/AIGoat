"""MCP surface operations: spawn, apply mcp.client controls, evaluate."""
from __future__ import annotations

import copy
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.lab_loader import get_lab_by_id
from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.mcp.client import run_allowlisted
from app.mcp.env import learner_scope
from app.mcp.registry import get_server_spec, servers_public

SURFACE = "mcp.client"
logger = logging.getLogger(__name__)
# Last raw tools/list for this process, keyed by user, lab, and server.
# The pin compares this text, not a description the browser sends.
_live_descriptions: dict[tuple[object, str, str], dict[str, str]] = {}
# Post-defense text the learner actually saw. The poisoning lab scores this, not the raw server text.
_shown_descriptions: dict[tuple[object, str, str], dict[str, str]] = {}


def resolve_mcp_level(data: dict[str, Any], user: Any, lab_id: str | None) -> int:
    lab = get_lab_by_id(lab_id) if lab_id else None
    if data.get("defense_level") is not None:
        return int(data["defense_level"])
    if lab and lab.defense_override is not None:
        return int(lab.defense_override)
    return int(getattr(user, "defense_level", 0) or 0)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _defense_dict(level: int, outcomes: list[dict[str, Any]], controls: list[str]) -> dict[str, Any]:
    return {
        "level": level,
        "surface": SURFACE,
        "controls_applied": controls,
        "outcomes": outcomes,
    }


def _outcomes_from_chain(outcomes) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for outcome in outcomes:
        if not outcome.control_id:
            continue
        try:
            stages = get_control(outcome.control_id).applies_to
        except KeyError:
            stages = ()
        stage = stages[0].value if stages else "tool_call"
        out.append({
            "control_id": outcome.control_id,
            "action": outcome.action.value,
            "stage": stage,
            "reason": outcome.reason,
        })
    return out


def _desc_key(user: Any, lab_id: str | None, server_id: str) -> tuple[object, str, str]:
    return (getattr(user, "id", None), lab_id or "", server_id)


def remember_live_descriptions(user: Any, lab_id: str | None, server_id: str, tools: list[dict[str, Any]]) -> None:
    _live_descriptions[_desc_key(user, lab_id, server_id)] = {
        str(tool.get("name") or ""): str(tool.get("description") or "")
        for tool in tools
        if tool.get("name")
    }


def remember_shown_descriptions(user: Any, lab_id: str | None, server_id: str, tools: list[dict[str, Any]]) -> None:
    _shown_descriptions[_desc_key(user, lab_id, server_id)] = {
        str(tool.get("name") or ""): str(tool.get("description") or "")
        for tool in tools
        if tool.get("name")
    }


def clear_live_descriptions(user_id: object, lab_id: str | None = None) -> None:
    for store in (_live_descriptions, _shown_descriptions):
        drop = [
            key for key in store
            if key[0] == user_id and (lab_id is None or key[1] == (lab_id or ""))
        ]
        for key in drop:
            store.pop(key, None)


def _scoring_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """What the learner was shown. Raw text stays on the API transcript for the diff."""
    scored: list[dict[str, Any]] = []
    for event in events:
        kind = event.get("type")
        if kind == "mcp_response":
            body = event.get("transformed") if event.get("transformed") is not None else event.get("raw")
            scored.append({"type": kind, "body": body})
        elif kind == "tool_result":
            scored.append({
                "type": kind,
                "tool": event.get("tool"),
                "server_id": event.get("server_id") or "",
                "content": event.get("content"),
                "is_error": bool(event.get("is_error")),
            })
        elif kind == "tool_call":
            row = {
                "type": kind,
                "tool": event.get("tool"),
                "server_id": event.get("server_id") or "",
                "arguments": event.get("arguments") if isinstance(event.get("arguments"), dict) else {},
            }
            if event.get("decision"):
                row["decision"] = event.get("decision")
            if event.get("ok") is not None:
                row["ok"] = event.get("ok")
            scored.append(row)
        elif kind == "control_decision":
            scored.append({
                "type": kind,
                "action": event.get("action"),
                "reason": event.get("reason"),
            })
    return scored


async def _evaluation(
    lab_id: str | None,
    message: str,
    output: str,
    transcript: list[dict[str, Any]],
    shown_description: str = "",
    db: Any = None,
    user_id: int | None = None,
):
    lab = get_lab_by_id(lab_id) if lab_id else None
    if lab and lab.completion and db is not None and isinstance(user_id, int):
        from app.challenges.completion import evaluate
        from app.mcp.evidence import load_evidence
        from app.mcp.registry import get_server_spec

        events = await load_evidence(db, user_id, lab_id or "")
        refs: dict[str, Any] = {}
        variants = [str(item) for item in (lab.surface_config or {}).get("variants") or []]
        if variants:
            from app.mcp.evidence import current_attempt
            from app.mcp.fixtures import choose_fixture, fixture_refs

            attempt = await current_attempt(db, user_id, lab_id or "")
            refs.update(fixture_refs(choose_fixture(user_id, lab_id or "", attempt, variants)))
        for server in (lab.surface_config or {}).get("servers") or []:
            try:
                spec = get_server_spec(str(server))
            except (ValidationError, NotFoundError, KeyError):
                continue
            shown_command = [
                item for item in (*spec.command_display(), *spec.command_display_redacted())
                if str(item).endswith(".py")
            ]
            refs[f"{server}.command_display"] = shown_command
            refs[f"{server}.module"] = spec.module
        verdict = evaluate(lab, events, refs)
        # MCP training labs record a finding. They do not award CTF flags.
        verdict["flag"] = None
        return verdict
    key = lab.challenge_evaluator if lab else None
    if not key:
        return None
    evaluator = get_evaluator_by_title(key)
    if evaluator is None:
        return None
    events = _scoring_events(transcript)
    if shown_description:
        events.append({
            "type": "mcp_response",
            "body": {"result": {"tools": [{"name": "lookup_ticket", "description": shown_description}]}},
        })
    triggered = evaluator.check_exploit(
        EvalContext(user_message=message, model_output=output, transcript=events)
    )
    return {
        "exploit_triggered": bool(triggered),
        "evaluator": key,
        "flag": None,
    }


def _pins_for_lab(lab_id: str | None) -> dict[str, str]:
    lab = get_lab_by_id(lab_id) if lab_id else None
    if lab is None:
        return {}
    raw = (lab.surface_config or {}).get("pinned_descriptions") or {}
    return {str(k): str(v) for k, v in raw.items()}


def _blocked_calls(lab_id: str | None) -> list[dict[str, Any]]:
    lab = get_lab_by_id(lab_id) if lab_id else None
    if lab is None:
        return []
    raw = (lab.surface_config or {}).get("blocked_calls") or []
    if not isinstance(raw, list):
        return []
    return [row for row in raw if isinstance(row, dict)]


class _Transcript:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def add(self, kind: str, **data: Any) -> None:
        payload = {"seq": len(self.events), "type": kind, "ts": _now(), **data}
        self.events.append(payload)


async def execute_mcp(
    *,
    user: Any,
    lab_id: str | None,
    data: dict[str, Any],
    db: Any = None,
) -> dict[str, Any]:
    op = str(data.get("action") or data.get("op") or "discover")
    server_id = str(data.get("server_id") or "")
    if not server_id:
        raise ValidationError("server_id is required")
    if op not in {"discover", "tools", "call"}:
        raise ValidationError(f"unknown MCP action {op!r}")
    if server_id == "internal_shop" and not getattr(user, "is_staff", False):
        raise ForbiddenError("Internal Management Server is only available to the admin assistant.")
    spec = get_server_spec(server_id)
    level = resolve_mcp_level(data, user, lab_id)
    tool = data.get("tool")
    tool_name = str(tool) if tool else ""
    arguments = data.get("arguments") if isinstance(data.get("arguments"), dict) else {}
    profile = resolve_profile(SURFACE, level) if level >= 1 else None
    controls = list(profile.controls) if profile else []
    outcomes: list[dict[str, Any]] = []
    pins = _pins_for_lab(lab_id)
    blocked = _blocked_calls(lab_id)
    denied = False
    deny_reason = None
    deny_control = None
    # The assistant snapshot is shared. Learner labs each get their own directory.
    user_id = getattr(user, "id", None)
    attempt = 1
    if db is not None and lab_id and isinstance(user_id, int):
        from app.mcp.evidence import current_attempt
        attempt = await current_attempt(db, user_id, lab_id)
    scope_id = user_id if user_id is not None else "anon"
    scope = None if server_id == "internal_shop" else learner_scope(
        scope_id, lab_id, attempt if lab_id else None
    )

    if op == "call" and level >= 1:
        live_desc = _live_descriptions.get(_desc_key(user, lab_id, server_id), {}).get(tool_name, "")
        if pins.get(tool_name) and not live_desc:
            denied = True
            deny_reason = "List tools first. This level compares the server's description to the pin."
            deny_control = "mcp.tool_pin"
        else:
            decision = DefenseDecision(
                surface=SURFACE,
                stage=DefenseStage.TOOL_CALL,
                payload=json.dumps({"tool": tool, "arguments": arguments}),
                level=level,
                context={
                    "tool": tool,
                    "tool_description": live_desc,
                    "pinned_descriptions": pins,
                    "blocked_calls": blocked,
                    "op": "call",
                },
                user_id=getattr(user, "id", None),
            )
            chain = await run_chain(controls, decision)
            outcomes.extend(_outcomes_from_chain(chain.outcomes))
            if chain.final.action is ControlAction.DENY:
                denied = True
                deny_reason = chain.final.reason
                deny_control = chain.final.control_id

    if denied:
        raw = {
            "protocol_version": None,
            "server_info": {},
            "capabilities": {},
            "instructions": "",
            "supported_versions": [],
            "discover": None,
            "transcript": [],
            "text": [],
            "tools": [],
            "is_error": False,
            "structured_content": None,
        }
    else:
        raw = await run_allowlisted(
            server_id,
            op,
            tool=tool_name or None,
            arguments=arguments,
            scope=scope,
            lab_id=lab_id,
            level=level,
        )
    visible_tools = copy.deepcopy(raw.get("tools") or [])
    raw_tools = copy.deepcopy(visible_tools)
    if op == "tools":
        remember_live_descriptions(user, lab_id, server_id, raw_tools)

    if op == "tools" and level >= 1:
        decision = DefenseDecision(
            surface=SURFACE,
            stage=DefenseStage.TOOL_CALL,
            payload=json.dumps(visible_tools),
            level=level,
            context={
                "tools": visible_tools,
                "pinned_descriptions": pins,
                "blocked_calls": blocked,
                "op": "tools",
            },
            user_id=getattr(user, "id", None),
        )
        chain = await run_chain(controls, decision)
        visible_tools = list(decision.context.get("tools") or visible_tools)
        outcomes.extend(_outcomes_from_chain(chain.outcomes))

    if op == "tools":
        remember_shown_descriptions(user, lab_id, server_id, visible_tools)

    visible_text = list(raw.get("text") or [])
    raw_text = list(visible_text)
    if op == "call" and not denied and level >= 1 and visible_text:
        moderated: list[str] = []
        transformed = False
        for chunk in visible_text:
            out = await defense_pipeline.moderate_output(chunk, level, surface=SURFACE)
            moderated.append(out)
            if out != chunk:
                transformed = True
        visible_text = moderated
        if transformed:
            from app.defense.controls.mcp_result_scan import text_has_exposed_secret

            removed_secret = any(text_has_exposed_secret(chunk) for chunk in raw_text) and not any(
                text_has_exposed_secret(chunk) for chunk in moderated
            )
            outcomes.append({
                "control_id": "mcp.result_scan" if removed_secret else "output.moderate",
                "action": "transform",
                "stage": "output",
                "reason": "redacted credential in tool result" if removed_secret else None,
            })

    transcript = _Transcript()
    message = f"{op}:{server_id}" + (f":{tool}" if tool else "")
    transcript.add("user_message", content=message, raw=message)
    for event in raw.get("transcript") or []:
        method = event.get("method")
        if method:
            transcript.add("mcp_request", method=method, raw=event)
            continue
        raw_event = event
        transformed = None
        if op == "tools" and isinstance(event.get("result"), dict) and "tools" in (event.get("result") or {}):
            raw_event = {**event, "result": {"tools": raw_tools}}
            if visible_tools != raw_tools:
                transformed = {**event, "result": {"tools": visible_tools}}
        elif (
            op == "call"
            and visible_text != raw_text
            and isinstance(event.get("result"), dict)
            and "content" in (event.get("result") or {})
        ):
            transformed = {**event, "result": {**event["result"], "content": visible_text}}
        transcript.add("mcp_response", raw=raw_event, transformed=transformed)
    call_failed = bool(raw.get("is_error"))
    if op == "call":
        transcript.add(
            "tool_call",
            tool=tool,
            server_id=server_id,
            arguments=arguments,
            decision="deny" if denied else "allow",
            ok=False if denied or call_failed else True,
            raw={"tool": tool, "arguments": arguments},
        )
        if not denied:
            joined = "\n".join(raw_text)
            visible_joined = "\n".join(visible_text)
            transcript.add(
                "tool_result",
                tool=tool,
                server_id=server_id,
                content=visible_joined,
                is_error=call_failed,
                raw=joined,
                transformed=visible_joined if visible_joined != joined else None,
            )
        else:
            transcript.add(
                "control_decision",
                control_id=deny_control or "mcp.tool_pin",
                action="deny",
                reason=deny_reason,
            )

    result: dict[str, Any] = {
        "server_id": server_id,
        "op": op,
        "protocol_version": raw.get("protocol_version"),
        "server_info": raw.get("server_info"),
        "capabilities": raw.get("capabilities"),
        "instructions": raw.get("instructions"),
        "supported_versions": raw.get("supported_versions"),
        "discover": raw.get("discover"),
        "command_display": spec.command_display(),
        "denied": denied,
        "deny_reason": deny_reason,
        "executed": not denied,
    }
    if op == "tools":
        result["tools"] = visible_tools
        result["tools_raw"] = raw_tools
    if op == "call":
        result["tool"] = tool
        result["arguments"] = arguments
        result["is_error"] = False if denied else raw.get("is_error")
        result["structured_content"] = None if denied else raw.get("structured_content")
        result["text"] = [] if denied else visible_text
        result["text_raw"] = [] if denied else raw_text

    api_transcript = transcript.events
    output = json.dumps(result.get("tools") or result.get("text") or result.get("discover") or {})
    shown = ""
    if op == "call" and tool_name == "read_internal_notes":
        shown = _shown_descriptions.get(_desc_key(user, lab_id, server_id), {}).get("lookup_ticket", "")
    args_sha = hashlib.sha256(
        json.dumps(arguments, sort_keys=True, default=str).encode()
    ).hexdigest()[:12]
    decision = "deny" if denied else "allow"
    logger.info(
        "mcp action user_id=%s lab_id=%s server_id=%s op=%s tool=%s level=%s decision=%s args_sha=%s",
        getattr(user, "id", None),
        lab_id or "",
        server_id,
        op,
        tool_name,
        level,
        decision,
        args_sha,
    )
    payload = {
        "result": result,
        "transcript": api_transcript,
        "defense": _defense_dict(level, outcomes, controls),
        "evaluation": await _evaluation(
            lab_id, message, output, api_transcript, shown, db=db, user_id=user_id if isinstance(user_id, int) else None
        ),
    }
    if db is not None and lab_id and isinstance(user_id, int):
        from app.mcp.evidence import append_events
        info = raw.get("server_info") if isinstance(raw.get("server_info"), dict) else {}
        await append_events(db, user_id, lab_id, _evidence_rows(
            op=op,
            server_id=server_id,
            claimed_name=str(info.get("name") or ""),
            level=level,
            tool=tool_name,
            arguments=arguments,
            denied=denied,
            deny_reason=deny_reason,
            deny_control=deny_control,
            call_failed=call_failed,
            visible_tools=visible_tools,
            visible_text=visible_text,
            structured=raw.get("structured_content") if isinstance(raw.get("structured_content"), dict) else {},
            digest=hashlib.sha256(output.encode()).hexdigest(),
        ))
    return payload


def _evidence_rows(
    *,
    op: str,
    server_id: str,
    claimed_name: str,
    level: int,
    tool: str,
    arguments: dict[str, Any],
    denied: bool,
    deny_reason: str | None,
    deny_control: str | None,
    call_failed: bool,
    visible_tools: list[dict[str, Any]],
    visible_text: list[str],
    structured: dict[str, Any],
    digest: str,
) -> list[dict[str, Any]]:
    base = {
        "surface": "mcp.client",
        "server_id": server_id,
        "claimed_name": claimed_name,
        "defense_level": level,
        "raw_digest": digest,
    }
    if op == "discover":
        return [{**base, "kind": "discover", "actor": "learner"}]
    if op == "tools":
        shown_tools = [
            {
                "name": row.get("name"),
                "description": row.get("description"),
                "inputSchema": row.get("inputSchema") or row.get("input_schema") or {},
            }
            for row in visible_tools
            if isinstance(row, dict)
        ]
        return [{**base, "kind": "tools_listed", "actor": "server", "shown": {"tools": shown_tools}}]
    if op != "call":
        return []
    call = {
        **base,
        "kind": "tool_call",
        "actor": "learner",
        "tool": tool,
        "args": arguments,
        "decision": "deny" if denied else "allow",
        "ok": False if denied or call_failed else True,
        "provenance": {"args": {key: {"source": "learner"} for key in arguments}},
    }
    if denied:
        return [
            call,
            {
                **base,
                "kind": "control_decision",
                "actor": "control",
                "tool": tool,
                "decision": "deny",
                "control_id": deny_control or "",
                "parent_index": 0,
                "data": {"reason": deny_reason or ""},
            },
        ]
    return [
        call,
        {
            **base,
            "kind": "tool_result",
            "actor": "server",
            "tool": tool,
            "args": arguments,
            "ok": not call_failed,
            "parent_index": 0,
            "shown": {"text": visible_text, "structured": structured},
        },
    ]


def list_servers() -> list[dict[str, object]]:
    return servers_public()
