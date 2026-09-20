"""MCP surface operations: spawn, apply mcp.client controls, evaluate."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from typing import Any

from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.core.exceptions import ValidationError
from app.core.lab_loader import get_lab_by_id
from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.mcp.client import run_allowlisted
from app.mcp.registry import get_server_spec, servers_public

SURFACE = "mcp.client"


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


def _evaluation(lab_id: str | None, message: str, output: str, transcript: list[dict[str, Any]]):
    lab = get_lab_by_id(lab_id) if lab_id else None
    key = lab.challenge_evaluator if lab else None
    if not key:
        return None
    evaluator = get_evaluator_by_title(key)
    if evaluator is None:
        return None
    triggered = evaluator.check_exploit(
        EvalContext(user_message=message, model_output=output, transcript=transcript)
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
) -> dict[str, Any]:
    op = str(data.get("action") or data.get("op") or "discover")
    server_id = str(data.get("server_id") or "")
    if not server_id:
        raise ValidationError("server_id is required")
    if op not in {"discover", "tools", "call"}:
        raise ValidationError(f"unknown MCP action {op!r}")
    level = resolve_mcp_level(data, user, lab_id)
    tool = data.get("tool")
    arguments = data.get("arguments") if isinstance(data.get("arguments"), dict) else {}
    raw = await run_allowlisted(
        server_id,
        op,
        tool=str(tool) if tool else None,
        arguments=arguments,
    )
    profile = resolve_profile(SURFACE, level) if level >= 1 else None
    controls = list(profile.controls) if profile else []
    outcomes: list[dict[str, Any]] = []
    pins = _pins_for_lab(lab_id)
    visible_tools = copy.deepcopy(raw.get("tools") or [])
    raw_tools = copy.deepcopy(visible_tools)

    if op == "tools" and level >= 1:
        decision = DefenseDecision(
            surface=SURFACE,
            stage=DefenseStage.TOOL_CALL,
            payload=json.dumps(visible_tools),
            level=level,
            context={"tools": visible_tools, "pinned_descriptions": pins, "op": "tools"},
            user_id=getattr(user, "id", None),
        )
        chain = await run_chain(controls, decision)
        visible_tools = list(decision.context.get("tools") or visible_tools)
        outcomes.extend(_outcomes_from_chain(chain.outcomes))

    denied = False
    deny_reason = None
    if op == "call" and level >= 1:
        live_desc = str(data.get("tool_description") or "")
        decision = DefenseDecision(
            surface=SURFACE,
            stage=DefenseStage.TOOL_CALL,
            payload=json.dumps({"tool": tool, "arguments": arguments}),
            level=level,
            context={
                "tool": tool,
                "tool_description": live_desc,
                "pinned_descriptions": pins,
                "op": "call",
            },
            user_id=getattr(user, "id", None),
        )
        chain = await run_chain(controls, decision)
        outcomes.extend(_outcomes_from_chain(chain.outcomes))
        if chain.final.action is ControlAction.DENY:
            denied = True
            deny_reason = chain.final.reason

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
            outcomes.append({
                "control_id": "output.moderate",
                "action": "transform",
                "stage": "output",
                "reason": None,
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
        transcript.add("mcp_response", raw=raw_event, transformed=transformed)
    if op == "call":
        transcript.add(
            "tool_call",
            tool=tool,
            arguments=arguments,
            raw={"tool": tool, "arguments": arguments},
        )
        if not denied:
            joined = "\n".join(raw_text)
            visible_joined = "\n".join(visible_text)
            transcript.add(
                "tool_result",
                tool=tool,
                content=visible_joined,
                raw=joined,
                transformed=visible_joined if visible_joined != joined else None,
            )
        else:
            transcript.add(
                "control_decision",
                control_id="mcp.tool_pin",
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
        "command_display": get_server_spec(server_id).command_display(),
        "denied": denied,
        "deny_reason": deny_reason,
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
        result["text_raw"] = raw_text

    api_transcript = transcript.events
    output = json.dumps(result.get("tools") or result.get("text") or result.get("discover") or {})
    return {
        "result": result,
        "transcript": api_transcript,
        "defense": _defense_dict(level, outcomes, controls),
        "evaluation": _evaluation(lab_id, message, output, api_transcript),
    }


def list_servers() -> list[dict[str, object]]:
    return servers_public()
