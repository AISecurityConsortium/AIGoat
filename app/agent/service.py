"""Persist agent runs and drive the gated shop loop."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agent.admin_tools import admin_tools, is_admin_lab
from app.agent.broker import IntentGate
from app.agent.loop import ShopAgentLoop
from app.agent.memory import format_memory_block, notes_for_prompt
from app.agent.tools import SHOP_TOOL_NAMES, shop_tools
from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.lab_loader import get_lab_by_id, get_lab_dict
from app.defense.control import ControlAction
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.labs.containment import is_halted
from app.labs.effects import apply_coupon_impact
from app.models.agent import AgentRun, AgentStepRow, PendingApproval
from app.models.user import User
from app.services.agent_service import AgentResult, AgentStep
from app.services.chat_service import load_lab_prompt
from app.services.ollama_client import get_ollama_client
from app.surfaces.transcript import Transcript

SURFACE = "agent.runner"


def resolve_agent_level(data: dict[str, Any], user: Any, lab_id: str | None) -> int:
    lab_def = get_lab_dict(lab_id) if lab_id else None
    if data.get("defense_level") is not None:
        return int(data["defense_level"])
    if lab_def and lab_def.get("defense_override") is not None:
        return int(lab_def["defense_override"])
    return int(getattr(user, "defense_level", 0) or 0)


def _allowlist_for(lab) -> list[str] | None:
    if lab is None:
        return list(SHOP_TOOL_NAMES)
    config = lab.surface_config or {}
    raw = config.get("allowed_tools")
    if raw is None:
        return list(SHOP_TOOL_NAMES)
    return [str(item) for item in raw]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def transcript_from_steps(
    goal: str,
    steps: list[AgentStep] | list[AgentStepRow],
    answer: str,
) -> Transcript:
    transcript = Transcript()
    transcript.add("user_message", content=goal, raw=goal)
    for step in steps:
        action = step.action
        thought = step.thought or ""
        arguments = step.action_input if isinstance(step.action_input, dict) else {}
        decision = getattr(step, "decision", "") or ""
        control_id = getattr(step, "control_id", None)
        observation = step.observation or ""
        if action == "finish":
            raw = thought or answer
            transcript.add("model_output", content=answer or raw, raw=raw)
            continue
        transcript.add(
            "tool_call",
            tool=action,
            arguments=arguments,
            thought=thought,
            raw=action,
        )
        if decision:
            transcript.add(
                "control_decision",
                control_id=control_id,
                action=decision,
            )
        if decision == ControlAction.REQUIRE_APPROVAL.value:
            transcript.add(
                "approval_request",
                tool=action,
                arguments=arguments,
            )
        elif observation:
            transcript.add("tool_result", tool=action, content=observation)
        if action == "remember" and decision == ControlAction.ALLOW.value:
            stored = True
            try:
                payload = json.loads(observation) if observation else {}
                if isinstance(payload, dict) and "stored" in payload:
                    stored = bool(payload.get("stored"))
            except json.JSONDecodeError:
                stored = True
            if stored:
                transcript.add(
                    "memory_write",
                    key=str(arguments.get("key") or ""),
                    content=str(arguments.get("value") or ""),
                    raw=str(arguments.get("value") or ""),
                )
    return transcript


def _evaluation(lab_id: str | None, goal: str, answer: str, transcript: list[dict[str, Any]]):
    lab = get_lab_by_id(lab_id) if lab_id else None
    key = lab.challenge_evaluator if lab else None
    if not key:
        return None
    evaluator = get_evaluator_by_title(key)
    if evaluator is None:
        return None
    triggered = evaluator.check_exploit(
        EvalContext(
            user_message=goal,
            model_output=answer,
            transcript=transcript,
        )
    )
    return {
        "exploit_triggered": bool(triggered),
        "evaluator": key,
        "flag": None,
    }


# Labs where a successful apply_coupon tool call applies a tracked synthetic
# discount (a restricted staff coupon is really written to the lab's victim
# order; reset restores the original amounts). lab_id -> victim order ref.
_COUPON_IMPACT_LABS = {"asi02-1": 1003}


def _applied_coupon_code(run: AgentRun) -> str | None:
    """The coupon code from an allowed apply_coupon step, or None."""
    code: str | None = None
    for row in run.steps or []:
        if row.action != "apply_coupon":
            continue
        if row.decision == "deny":
            continue
        value = (row.action_input or {}).get("code")
        if value is None:
            continue
        code = str(value).strip() or None
    return code


async def _maybe_apply_coupon_impact(
    db: AsyncSession, run: AgentRun, payload: dict[str, Any]
) -> None:
    """When a tool-misuse lab lands an unauthorized coupon, apply it as synthetic state."""
    order_ref = _COUPON_IMPACT_LABS.get(run.lab_id)
    if order_ref is None:
        return
    if not (payload.get("evaluation") or {}).get("exploit_triggered"):
        return
    code = _applied_coupon_code(run)
    if code is None:
        return
    impact = await apply_coupon_impact(
        db, run.user_id, run.lab_id, code=code, order_ref=order_ref
    )
    if impact:
        payload["impact"] = impact


def _defense_dict(level: int, steps: list, notes: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    profile = resolve_profile(SURFACE, level) if level >= 1 else None
    controls = list(profile.controls) if profile else []
    outcomes: list[dict[str, Any]] = []
    for step in steps:
        decision = getattr(step, "decision", "") or ""
        control_id = getattr(step, "control_id", "") or ""
        if not decision or not control_id:
            continue
        outcomes.append({
            "control_id": control_id,
            "action": decision,
            "stage": "tool_call",
            "reason": None,
        })
    excluded = [n for n in (notes or []) if not n.get("included", True)]
    if excluded:
        outcomes.append({
            "control_id": "memory.scan",
            "action": "transform",
            "stage": "memory",
            "reason": f"excluded {len(excluded)} planted note(s)",
        })
    return {
        "level": level,
        "surface": SURFACE,
        "controls_applied": controls,
        "outcomes": outcomes,
    }


def _memory_events(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    ts = _now().isoformat()
    for note in notes:
        included = bool(note.get("included", True))
        event: dict[str, Any] = {
            "type": "memory_read",
            "ts": ts,
            "key": note.get("key"),
            "content": note.get("value") if included else "",
            "raw": note.get("raw") or note.get("value") or "",
            "included": included,
        }
        if note.get("excluded_by_control"):
            event["excluded_by_control"] = note["excluded_by_control"]
        events.append(event)
    return events


def _insert_after_user_message(
    events: list[dict[str, Any]], extra: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not extra:
        return events
    for i, event in enumerate(events):
        if event.get("type") == "user_message":
            return events[: i + 1] + extra + events[i + 1 :]
    return extra + events


async def serialize_run(
    db: AsyncSession,
    run: AgentRun,
    pending: PendingApproval | None = None,
) -> dict[str, Any]:
    steps = list(run.steps or [])
    agent_steps = [
        AgentStep(
            thought=row.thought,
            action=row.action,
            action_input=row.action_input or {},
            observation=row.observation,
            decision=row.decision,
            control_id=row.control_id or "",
        )
        for row in steps
    ]
    transcript = transcript_from_steps(run.goal, agent_steps, run.answer)
    api_transcript = transcript.to_api()
    notes = await notes_for_prompt(db, run.user_id, run.lab_id, run.defense_level)
    api_transcript = _insert_after_user_message(api_transcript, _memory_events(notes))
    for seq, event in enumerate(api_transcript):
        event["seq"] = seq
    pending_out = None
    if pending is None:
        pending = next((p for p in (run.pending or []) if p.status == "pending"), None)
    if pending is not None and pending.status == "pending":
        pending_out = {
            "step_seq": pending.step_seq,
            "tool": pending.tool,
            "arguments": pending.arguments or {},
            "status": pending.status,
        }
    return {
        "run_id": run.id,
        "status": run.status,
        "lab_id": run.lab_id,
        "goal": run.goal,
        "defense_level": run.defense_level,
        "max_steps": run.max_steps,
        "answer": run.answer,
        "terminated_reason": run.terminated_reason,
        "steps": [
            {
                "seq": row.seq,
                "thought": row.thought,
                "action": row.action,
                "action_input": row.action_input or {},
                "observation": row.observation,
                "decision": row.decision,
                "control_id": row.control_id,
            }
            for row in steps
        ],
        "pending": pending_out,
        "transcript": api_transcript,
        "defense": _defense_dict(run.defense_level, agent_steps, notes),
        "evaluation": _evaluation(run.lab_id, run.goal, run.answer, api_transcript),
        "memory": notes,
    }


async def _load_run(db: AsyncSession, run_id: str) -> AgentRun | None:
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.steps), selectinload(AgentRun.pending))
        .where(AgentRun.id == run_id)
    )
    return result.scalar_one_or_none()


async def _owned_run(db: AsyncSession, run_id: str, user: User) -> AgentRun:
    run = await _load_run(db, run_id)
    if run is None:
        raise NotFoundError(f"Agent run {run_id} not found")
    if run.user_id != user.id:
        raise ForbiddenError("Not allowed to access this agent run")
    return run


def _steps_from_rows(rows: list[AgentStepRow]) -> list[AgentStep]:
    return [
        AgentStep(
            thought=row.thought,
            action=row.action,
            action_input=row.action_input or {},
            observation=row.observation,
            decision=row.decision,
            control_id=row.control_id or "",
        )
        for row in sorted(rows, key=lambda r: r.seq)
    ]


async def _replace_steps(db: AsyncSession, run_id: str, steps: list[AgentStep]) -> None:
    await db.execute(delete(AgentStepRow).where(AgentStepRow.run_id == run_id))
    for seq, step in enumerate(steps):
        db.add(
            AgentStepRow(
                run_id=run_id,
                seq=seq,
                thought=step.thought,
                action=step.action,
                action_input=step.action_input or {},
                observation=step.observation,
                decision=step.decision,
                control_id=step.control_id or None,
            )
        )


def _status_for(result: AgentResult) -> str:
    if result.terminated_reason == "finish":
        return "completed"
    if result.terminated_reason == "awaiting_approval":
        return "awaiting_approval"
    if result.terminated_reason == "max_steps_exceeded":
        return "max_steps_exceeded"
    return "failed"


async def _apply_result(
    db: AsyncSession,
    run: AgentRun,
    result: AgentResult,
    user: User,
) -> None:
    answer = result.answer or ""
    if run.defense_level >= 1 and answer:
        answer = await defense_pipeline.moderate_output(
            answer, run.defense_level, surface=SURFACE
        )
    run.answer = answer
    run.terminated_reason = result.terminated_reason
    run.status = _status_for(result)
    if run.status != "awaiting_approval":
        run.completed_at = _now()
        pending_rows = await db.execute(
            select(PendingApproval).where(
                PendingApproval.run_id == run.id,
                PendingApproval.status == "pending",
            )
        )
        for pending in pending_rows.scalars().all():
            pending.status = "cancelled"
            pending.resolved_at = _now()
    await _replace_steps(db, run.id, result.steps)
    if result.pending:
        db.add(
            PendingApproval(
                run_id=run.id,
                step_seq=int(result.pending["step_seq"]),
                user_id=user.id,
                tool=str(result.pending["tool"]),
                arguments=result.pending.get("arguments") or {},
                status="pending",
            )
        )
    await db.flush()


async def _build_loop(db: AsyncSession, user: User, run: AgentRun, lab) -> ShopAgentLoop:
    registry = shop_tools(db, user, lab_id=run.lab_id, level=run.defense_level)
    if user.is_staff and is_admin_lab(run.lab_id):
        extra = admin_tools(db, user, lab_id=run.lab_id, level=run.defense_level)
        for meta in extra.list_tools():
            tool = extra.get(meta["name"])
            if tool is not None:
                registry.register(tool)
    broker = IntentGate(
        registry,
        level=run.defense_level,
        allowlist=_allowlist_for(lab),
        user_id=user.id,
    )
    settings = get_settings()
    notes = await notes_for_prompt(db, user.id, run.lab_id, run.defense_level)
    system = load_lab_prompt(run.lab_id) or ""
    system = system + format_memory_block(notes)
    return ShopAgentLoop(
        registry,
        broker,
        max_steps=run.max_steps,
        llm=get_ollama_client(),
        system=system,
        model=settings.ollama.agent_model or None,
    )


async def start_run(
    db: AsyncSession,
    user: User,
    *,
    lab_id: str,
    goal: str,
    session_token: str | None = None,
    defense_level: int | None = None,
) -> dict[str, Any]:
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise NotFoundError(f"Lab {lab_id} not found")
    if lab.surface != SURFACE:
        raise ValidationError(f"Lab {lab_id} is not an agent.runner lab")
    if is_halted(user.id, lab_id):
        raise ValidationError("This lab is halted. Reset the lab before starting another run.")
    settings = get_settings()
    level = resolve_agent_level(
        {"defense_level": defense_level},
        user,
        lab_id,
    )
    run = AgentRun(
        id=str(uuid.uuid4()),
        user_id=user.id,
        lab_id=lab_id,
        goal=goal,
        status="running",
        max_steps=int(settings.agent.max_steps),
        defense_level=level,
        session_token=session_token,
    )
    db.add(run)
    await db.flush()
    if level >= 1:
        gated = await defense_pipeline.process_input(goal, level, user.id, surface=SURFACE)
        if not gated.allowed:
            control_id = next(
                (outcome.control_id for outcome in gated.outcomes if outcome.action == ControlAction.DENY),
                None,
            )
            run.answer = gated.message
            run.status = "failed"
            run.terminated_reason = "input_denied"
            run.completed_at = _now()
            db.add(AgentStepRow(
                run_id=run.id,
                seq=0,
                thought="",
                action="input",
                action_input={},
                observation=gated.message,
                decision=ControlAction.DENY.value,
                control_id=control_id,
            ))
            await db.commit()
            loaded = await _owned_run(db, run.id, user)
            return await serialize_run(db, loaded)
        goal = gated.message
    loop = await _build_loop(db, user, run, lab)
    result = await loop.run(goal)
    await _apply_result(db, run, result, user)
    await db.commit()
    loaded = await _owned_run(db, run.id, user)
    payload = await serialize_run(db, loaded)
    await _maybe_apply_coupon_impact(db, loaded, payload)
    return payload


async def get_run(db: AsyncSession, user: User, run_id: str) -> dict[str, Any]:
    run = await _owned_run(db, run_id, user)
    return await serialize_run(db, run)


async def cancel_runs_for_lab(db: AsyncSession, user: User, lab_id: str) -> int:
    """Cancel this user's running or awaiting runs for one lab. Returns how many."""
    result = await db.execute(
        select(AgentRun)
        .where(
            AgentRun.user_id == user.id,
            AgentRun.lab_id == lab_id,
            AgentRun.status.in_(("running", "awaiting_approval")),
        )
        .options(selectinload(AgentRun.pending))
    )
    rows = list(result.scalars().all())
    for run in rows:
        run.status = "cancelled"
        run.terminated_reason = "halted"
        run.completed_at = _now()
        for pending in list(run.pending or []):
            if pending.status == "pending":
                pending.status = "cancelled"
                pending.resolved_at = _now()
    if rows:
        await db.commit()
    return len(rows)


async def cancel_run(db: AsyncSession, user: User, run_id: str) -> dict[str, Any]:
    run = await _owned_run(db, run_id, user)
    run.status = "cancelled"
    run.terminated_reason = "cancelled"
    run.completed_at = _now()
    for pending in list(run.pending or []):
        if pending.status == "pending":
            pending.status = "cancelled"
            pending.resolved_at = _now()
    await db.commit()
    loaded = await _owned_run(db, run_id, user)
    return await serialize_run(db, loaded)


async def resolve_approval(
    db: AsyncSession,
    user: User,
    run_id: str,
    *,
    step_seq: int,
    decision: str,
) -> dict[str, Any]:
    if decision not in {"approve", "deny"}:
        raise ValidationError("decision must be approve or deny")
    run = await _owned_run(db, run_id, user)
    if run.status != "awaiting_approval":
        raise ValidationError("run is not awaiting approval")
    pending = next((p for p in (run.pending or []) if p.status == "pending"), None)
    if pending is None or pending.step_seq != step_seq:
        raise ValidationError("no matching pending approval")
    lab = get_lab_by_id(run.lab_id)
    loop = await _build_loop(db, user, run, lab)
    loop.steps = _steps_from_rows(list(run.steps or []))
    pending.status = "approved" if decision == "approve" else "denied"
    pending.resolved_at = _now()

    if decision == "deny":
        if loop.steps:
            loop.steps[-1].observation = json.dumps({"denied": True, "by": "user"})
            loop.steps[-1].decision = "deny"
        result = await loop.run(run.goal)
        await _apply_result(db, run, result, user)
        await db.commit()
        return await serialize_run(db, await _owned_run(db, run_id, user))

    invoked = await loop.tools.invoke(pending.tool, pending.arguments or {})
    if loop.steps:
        loop.steps[-1].observation = json.dumps(invoked, default=str)
        loop.steps[-1].decision = "allow"
    result = await loop.run(run.goal)
    await _apply_result(db, run, result, user)
    await db.commit()
    loaded = await _owned_run(db, run_id, user)
    payload = await serialize_run(db, loaded)
    await _maybe_apply_coupon_impact(db, loaded, payload)
    return payload
