"""Persist agent runs and drive the gated shop loop."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agent.broker import IntentGate
from app.agent.loop import ShopAgentLoop
from app.agent.tools import SHOP_TOOL_NAMES, shop_tools
from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.lab_loader import get_lab_by_id, get_lab_dict
from app.defense.control import ControlAction
from app.defense.pipeline import defense_pipeline
from app.defense.profiles import resolve_profile
from app.models.agent import AgentRun, AgentStepRow, PendingApproval
from app.models.user import User
from app.services.agent_service import AgentResult, AgentStep
from app.services.chat_service import load_lab_prompt
from app.services.ollama_client import get_ollama_client
from app.surfaces.transcript import Transcript

SURFACE = "agent.runner"
_SKILL_SURFACE = "skill.runtime"


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


def _defense_dict(level: int, steps: list) -> dict[str, Any]:
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
    return {
        "level": level,
        "surface": SURFACE,
        "controls_applied": controls,
        "outcomes": outcomes,
    }


def serialize_run(run: AgentRun, pending: PendingApproval | None = None) -> dict[str, Any]:
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
    from app.skills.runtime import get_install, transcript_for_install

    install = get_install(run.user_id, run.lab_id)
    if install is not None:
        skill_events = [
            event for event in transcript_for_install(install) if event.get("type") == "skill_load"
        ]
        api_transcript = skill_events + api_transcript
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
        "defense": _defense_dict(run.defense_level, agent_steps),
        "evaluation": _evaluation(run.lab_id, run.goal, run.answer, api_transcript),
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


def _build_loop(db: AsyncSession, user: User, run: AgentRun, lab) -> ShopAgentLoop:
    from app.skills.runtime import get_install, overlay_allowlist, overlay_system

    registry = shop_tools(db, user)
    install = get_install(user.id, run.lab_id)
    broker = IntentGate(
        registry,
        level=run.defense_level,
        allowlist=overlay_allowlist(_allowlist_for(lab), install),
        user_id=user.id,
    )
    settings = get_settings()
    system = overlay_system(load_lab_prompt(run.lab_id) or "", install)
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
    if lab.surface not in {SURFACE, _SKILL_SURFACE}:
        raise ValidationError(f"Lab {lab_id} is not an agent.runner or skill.runtime lab")
    settings = get_settings()
    level = resolve_agent_level(
        {"defense_level": defense_level},
        user,
        lab_id,
    )
    if lab.surface == _SKILL_SURFACE:
        from app.skills.runtime import get_install, install_skill

        if get_install(user.id, lab_id) is None:
            skill_id = (lab.surface_config or {}).get("skill_id")
            if skill_id:
                await install_skill(
                    user_id=user.id,
                    lab_id=lab_id,
                    skill_id=str(skill_id),
                    level=level,
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
    loop = _build_loop(db, user, run, lab)
    result = await loop.run(goal)
    await _apply_result(db, run, result, user)
    await db.commit()
    loaded = await _owned_run(db, run.id, user)
    return serialize_run(loaded)


async def get_run(db: AsyncSession, user: User, run_id: str) -> dict[str, Any]:
    run = await _owned_run(db, run_id, user)
    return serialize_run(run)


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
    return serialize_run(loaded)


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
    loop = _build_loop(db, user, run, lab)
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
        return serialize_run(await _owned_run(db, run_id, user))

    invoked = await loop.tools.invoke(pending.tool, pending.arguments or {})
    if loop.steps:
        loop.steps[-1].observation = json.dumps(invoked, default=str)
        loop.steps[-1].decision = "allow"
    result = await loop.run(run.goal)
    await _apply_result(db, run, result, user)
    await db.commit()
    return serialize_run(await _owned_run(db, run_id, user))
