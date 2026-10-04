"""Labs API route handlers.

Lab definitions are loaded from ``config/labs/*.yml`` via the
lab manifest loader. This module contains only thin route handlers.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.memory import clear_lab_memory
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.lab_loader import get_all_labs, get_lab_by_id, get_lab_dict
from app.core.taxonomy import labs_for_risk, risks_for_lab
from app.mcp.env import learner_scope, reset_server_state
from app.mcp.evidence import append_events, current_attempt, learner_view
from app.mcp.service import clear_live_descriptions
from app.models import LabEvent, LabSession, User
from app.schemas.lab import LabOut, LabStartOut

router = APIRouter(prefix="", tags=["labs"])


def get_lab_definition(lab_id: str) -> dict[str, Any] | None:
    """Public helper used by chat.py to resolve lab metadata."""
    return get_lab_dict(lab_id)


def _related_lab_ids(lab_id: str) -> list[str]:
    seen: list[str] = []
    for risk in risks_for_lab(lab_id):
        for other in labs_for_risk(risk.id):
            if other == lab_id or other in seen:
                continue
            seen.append(other)
    return seen


def _submission_fields(lab) -> list[str]:
    names: list[str] = []
    for stage in (lab.completion or {}).get("stages") or []:
        submit = stage.get("submit") if isinstance(stage, dict) else None
        if not isinstance(submit, dict):
            continue
        groups = submit.get("any_of") if isinstance(submit.get("any_of"), list) else [submit]
        for group in groups:
            if isinstance(group, dict):
                names.extend(str(key) for key in group if str(key) not in names)
    return names


def _lab_out(lab, sess: LabSession | None, *, hints_revealed: int = 0, solution_revealed: bool = False) -> LabOut:
    show = _show_walkthrough(lab, sess, solution_revealed)
    expected = {str(k): v for k, v in (lab.expected_by_level or {}).items()}
    if (lab.ui or {}).get("learner_first") and not show:
        expected = {}
    return LabOut(
        id=lab.id,
        name=lab.name,
        owasp=lab.owasp,
        status=lab.status,
        defense_override=lab.defense_override,
        description=lab.description,
        started_at=sess.started_at.isoformat() if sess else None,
        completed_at=sess.completed_at.isoformat() if sess and sess.completed_at else None,
        reset_count=sess.reset_count if sess else 0,
        risks=list(lab.risks),
        primary_risk=lab.primary_risk or (lab.risks[0] if lab.risks else ""),
        surface=lab.surface,
        difficulty=lab.difficulty,
        objective=lab.objective if show else "",
        prerequisites=list(lab.prerequisites),
        attack_steps=list(lab.attack_steps),
        example_payloads=list(lab.example_payloads) if show else [],
        expected_by_level=expected,
        remediation=lab.remediation,
        references=list(lab.references),
        challenge_id=lab.challenge_id,
        related_lab_ids=_related_lab_ids(lab.id),
        briefing=lab.briefing or "",
        hint_count=len(lab.hints or ()),
        hints_revealed=hints_revealed,
        ui=dict(lab.ui or {}),
        stages=[
            {"id": stage.get("id"), "label": stage.get("label") or ""}
            for stage in (lab.completion or {}).get("stages") or []
            if isinstance(stage, dict)
        ],
        submission_fields=_submission_fields(lab),
        solution_revealed=solution_revealed,
        recommended_server_id=_recommended_server(lab),
        servers=[str(item) for item in (lab.surface_config or {}).get("servers") or []],
        has_fixture=bool((lab.surface_config or {}).get("variants")),
        takeaway=dict(lab.takeaway or {}) if show else {},
    )


def _show_walkthrough(lab, sess: LabSession | None, solution_revealed: bool) -> bool:
    if not lab.completion:
        return True
    if solution_revealed:
        return True
    return bool(sess and sess.completed_at)


def _recommended_server(lab) -> str:
    if lab.surface != "mcp.client":
        return ""
    if "recommended_server" in (lab.ui or {}):
        return str(lab.ui.get("recommended_server") or "")
    return str((lab.surface_config or {}).get("server_id") or "")


def _matches_filters(
    lab,
    *,
    framework: str | None,
    risk: str | None,
    primary_only: bool,
    surface: str | None,
    difficulty: str | None,
    status: str | None,
) -> bool:
    if status and lab.status != status:
        return False
    if surface and lab.surface != surface:
        return False
    if difficulty and lab.difficulty != difficulty:
        return False
    primary = lab.primary_risk or (lab.risks[0] if lab.risks else "")
    if risk:
        if primary_only:
            if primary != risk:
                return False
        elif risk not in lab.risks:
            return False
    if framework and not any(r.startswith(f"{framework}:") for r in lab.risks):
        return False
    return True


@router.get("/api/labs/", response_model=list[LabOut])
async def list_labs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    framework: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    primary_only: bool = Query(default=False),
    surface: str | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[LabOut]:
    """List labs from the YAML manifest with the current user's session progress."""
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id)
    )
    sessions = {s.lab_id: s for s in result.scalars().all()}
    guide = await _guide(db, user.id, sessions)
    out: list[LabOut] = []
    for lab in get_all_labs():
        if not _matches_filters(
            lab,
            framework=framework,
            risk=risk,
            primary_only=primary_only,
            surface=surface,
            difficulty=difficulty,
            status=status,
        ):
            continue
        hints_revealed, solution_revealed = guide.get(lab.id, (0, False))
        out.append(_lab_out(
            lab,
            sessions.get(lab.id),
            hints_revealed=hints_revealed,
            solution_revealed=solution_revealed,
        ))
    return out


@router.get("/api/labs/{lab_id}", response_model=LabOut)
async def get_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabOut:
    """Return one lab with session progress for the current user."""
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise NotFoundError(f"Lab {lab_id} not found")
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = result.scalar_one_or_none()
    guide = await _guide(db, user.id, {lab_id: sess} if sess else {})
    hints_revealed, solution_revealed = guide.get(lab_id, (0, False))
    return _lab_out(lab, sess, hints_revealed=hints_revealed, solution_revealed=solution_revealed)


async def _guide(db: AsyncSession, user_id: int, sessions: dict) -> dict[str, tuple[int, bool]]:
    result = await db.execute(
        select(LabEvent.lab_id, LabEvent.kind, LabEvent.attempt).where(
            LabEvent.user_id == user_id,
            LabEvent.kind.in_(("hint_revealed", "solution_revealed")),
        )
    )
    found: dict[str, tuple[int, bool]] = {}
    for lab_id, kind, attempt in result.all():
        sess = sessions.get(lab_id)
        current = sess.attempt if sess else 1
        if attempt != current:
            continue
        hints, revealed = found.get(lab_id, (0, False))
        if kind == "hint_revealed":
            hints += 1
        if kind == "solution_revealed":
            revealed = True
        found[lab_id] = (hints, revealed)
    return found


@router.post("/api/labs/{lab_id}/start", response_model=LabStartOut)
async def start_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LabStartOut:
    """Create or return a LabSession for the current user."""
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise NotFoundError(f"Lab {lab_id} not found")
    if lab.status == "coming_soon":
        raise HTTPException(status_code=400, detail="Lab coming soon")

    existing = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = existing.scalar_one_or_none()
    if sess:
        return LabStartOut(
            lab_id=lab_id,
            started_at=sess.started_at.isoformat(),
            surface=lab.surface,
            already_started=True,
        )

    sess = LabSession(
        user_id=user.id,
        lab_id=lab_id,
        started_at=datetime.now(timezone.utc),
        surface=lab.surface,
        session_token=secrets.token_hex(16),
    )
    db.add(sess)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing2 = await db.execute(
            select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
        )
        sess2 = existing2.scalar_one_or_none()
        if sess2:
            return LabStartOut(
                lab_id=lab_id,
                started_at=sess2.started_at.isoformat(),
                surface=lab.surface,
                already_started=True,
            )
        raise HTTPException(status_code=409, detail="Could not start lab. Try again.")
    await db.refresh(sess)
    return LabStartOut(
        lab_id=lab_id,
        started_at=sess.started_at.isoformat(),
        surface=lab.surface,
        already_started=False,
    )


@router.post("/api/labs/{lab_id}/reset")
async def reset_lab(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Reset a lab session for the current user, clearing completion status."""
    lab_def = get_lab_dict(lab_id)
    if not lab_def:
        raise HTTPException(status_code=404, detail="Lab not found")
    if lab_def.get("status") == "coming_soon":
        raise HTTPException(status_code=400, detail="Lab coming soon")
    server_id = str((lab_def.get("surface_config") or {}).get("server_id") or "")
    result = await db.execute(
        select(LabSession).where(
            LabSession.user_id == user.id,
            LabSession.lab_id == lab_id,
        )
    )
    sess = result.scalar_one_or_none()
    if sess:
        await clear_lab_memory(db, user.id, lab_id)
        sess.completed_at = None
        sess.reset_count = (sess.reset_count or 0) + 1
        sess.attempt = (sess.attempt or 1) + 1
        if lab_def.get("surface") == "mcp.client" and server_id:
            reset_server_state(server_id, learner_scope(user.id, lab_id, sess.attempt))
            clear_live_descriptions(user.id, lab_id)
        if lab_def.get("surface") == "mcp.host":
            from app.mcp.host import clear_addons

            clear_addons(user.id, lab_id)
        await db.commit()
        await db.refresh(sess)
        return {"reset": True, "lab_id": lab_id, "reset_count": sess.reset_count}
    await clear_lab_memory(db, user.id, lab_id)
    new_sess = LabSession(
        user_id=user.id,
        lab_id=lab_id,
        reset_count=1,
        attempt=2,
        surface=lab_def.get("surface"),
        session_token=secrets.token_hex(16),
    )
    if lab_def.get("surface") == "mcp.client" and server_id:
        reset_server_state(server_id, learner_scope(user.id, lab_id, 2))
        clear_live_descriptions(user.id, lab_id)
    if lab_def.get("surface") == "mcp.host":
        from app.mcp.host import clear_addons

        clear_addons(user.id, lab_id)
    db.add(new_sess)
    await db.commit()
    return {"reset": True, "lab_id": lab_id, "reset_count": 1}


async def _require_lab(lab_id: str, user: User, db: AsyncSession):
    lab = get_lab_by_id(lab_id)
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    if not lab.completion:
        raise HTTPException(status_code=404, detail="This lab has no guided completion")
    return lab


@router.post("/api/labs/{lab_id}/agent-step")
async def lab_agent_step(
    lab_id: str,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Deterministic planner simulation over the descriptions this attempt was shown.

    Pilot only: this is not a live model. Genuine model-mediated behaviour is a
    later enhancement. The simulation does not invoke the tool and does not
    complete the lab.
    """
    from app.mcp.victim_planner import VictimPlanner

    lab = await _require_lab(lab_id, user, db)
    ui = lab.ui or {}
    if not (ui.get("agent_mode") or ui.get("planner_simulation")):
        raise HTTPException(status_code=404, detail="This lab has no planner step")
    attempt = await current_attempt(db, user.id, lab_id)
    result = await db.execute(
        select(LabEvent).where(
            LabEvent.user_id == user.id,
            LabEvent.lab_id == lab_id,
            LabEvent.attempt == attempt,
            LabEvent.kind == "tools_listed",
        ).order_by(LabEvent.seq.desc())
    )
    latest = result.scalars().first()
    tools = []
    if latest and isinstance(latest.shown, dict):
        tools = [row for row in (latest.shown.get("tools") or []) if isinstance(row, dict)]
    goal = str(body.get("goal") or "Answer using the tool list.")
    observation = "\n".join(
        f"{row.get('name')}: {row.get('description')}" for row in tools
    )
    planner = VictimPlanner(level=0)
    call = planner.choose(goal, observation, {str(row.get("name") or "") for row in tools})
    if call and call.get("name"):
        message = (
            "Based on the advertised tool metadata, the planner would next "
            f"invoke: {call['name']}."
        )
    else:
        message = "Based on the advertised tool metadata, the planner would not add another action."
    baseline = [
        {"name": str(step.get("name") or ""), "arguments": dict(step.get("arguments") or {})}
        for step in (ui.get("planner_baseline") or [])
        if isinstance(step, dict) and step.get("name")
    ]
    plan = [{**step, "source": "request"} for step in baseline]
    if call and call.get("name") and all(step["name"] != call["name"] for step in baseline):
        schema = next((row.get("inputSchema") or {} for row in tools if row.get("name") == call["name"]), {})
        accepted = set((schema.get("properties") or {}) if isinstance(schema, dict) else {})
        arguments = dict(call.get("arguments") or {})
        for step in baseline:
            for key, value in step["arguments"].items():
                if key in accepted and key not in arguments:
                    arguments[key] = value
        plan.append({"name": str(call["name"]), "arguments": arguments, "source": "metadata"})
    changed = len(plan) != len(baseline)
    canned = (lab.surface_config or {}).get("planner_effects") or {}
    effects = [
        {
            "name": step["name"],
            "arguments": step["arguments"],
            "source": step["source"],
            "result": str(canned.get(step["name"]) or "No simulated result is defined for this step."),
        }
        for step in plan
    ]
    question = str(ui.get("planner_question") or "")
    lines = [
        f"Request: {question}" if question else "",
        "Baseline plan: " + " -> ".join(_step_text(step) for step in baseline),
        "Simulated plan: " + " -> ".join(_step_text(step) for step in plan),
        message,
    ] + [f"Simulated result of {_step_text(row)}: {row['result']}" for row in effects]
    await append_events(db, user.id, lab_id, [{
        "kind": "planner_simulated",
        "actor": "system",
        "shown": {"text": [line for line in lines if line], "tools": tools},
        "data": {"call": call or {}, "baseline": baseline, "plan": plan, "changed": changed, "effects": effects},
    }])
    return {
        "call": call,
        "message": message,
        "simulated": True,
        "question": question,
        "baseline": baseline,
        "plan": plan,
        "changed": changed,
        "effects": effects,
        "tools_considered": len(tools),
        "tools": [{"name": row.get("name"), "description": row.get("description")} for row in tools],
        "note": "Deterministic planner simulation. No tool was called on the server, and it does not complete the lab.",
    }


def _step_text(step: dict) -> str:
    args = ", ".join(f"{key}={value}" for key, value in (step.get("arguments") or {}).items())
    return f"{step.get('name')}({args})"


@router.get("/api/labs/{lab_id}/fixture")
async def lab_fixture(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.mcp.fixtures import choose_fixture

    lab = await _require_lab(lab_id, user, db)
    variants = [str(item) for item in (lab.surface_config or {}).get("variants") or []]
    if not variants:
        raise HTTPException(status_code=404, detail="This lab has no recorded log")
    attempt = await current_attempt(db, user.id, lab_id)
    chosen = choose_fixture(user.id, lab_id, attempt, variants)
    await append_events(db, user.id, lab_id, [{
        "kind": "fixture_viewed",
        "actor": "learner",
        "surface": str(lab.surface or ""),
        "data": {"fixture": chosen["id"]},
    }])
    payload = {"lab_id": lab_id, "attempt": attempt, "events": chosen["events"]}
    if chosen.get("session"):
        payload["session"] = chosen["session"]
    return payload


@router.get("/api/labs/{lab_id}/progress")
async def lab_progress(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    lab = await _require_lab(lab_id, user, db)
    return await _progress_payload(db, user, lab)


@router.post("/api/labs/{lab_id}/hints/next")
async def lab_next_hint(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    lab = await _require_lab(lab_id, user, db)
    attempt = await current_attempt(db, user.id, lab_id)
    revealed = await _hint_count(db, user.id, lab_id, attempt)
    hints = list(lab.hints or ())
    if revealed < len(hints):
        await append_events(db, user.id, lab_id, [{
            "kind": "hint_revealed",
            "actor": "learner",
            "data": {"tier": revealed + 1},
        }])
        revealed += 1
    return {"hints": hints[:revealed], "revealed": revealed, "total": len(hints)}


@router.post("/api/labs/{lab_id}/submit")
async def lab_submit(
    lab_id: str,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.mcp.progress import record_lab_result
    from app.mcp.service import _evaluation

    lab = await _require_lab(lab_id, user, db)
    fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}
    await append_events(db, user.id, lab_id, [{
        "kind": "submission",
        "actor": "learner",
        "data": {"fields": {str(key): str(value) for key, value in fields.items()}},
    }])
    evaluation = await _evaluation(lab_id, "", "", [], db=db, user_id=user.id)
    await record_lab_result(db, user, lab_id, evaluation)
    guidance = ""
    met = bool((evaluation or {}).get("exploit_triggered"))
    if (lab.ui or {}).get("learner_first") and not met:
        picked = None
        if str(fields.get("evidence") or "").isdigit():
            attempt = await current_attempt(db, user.id, lab_id)
            picked_result = await db.execute(
                select(LabEvent).where(
                    LabEvent.user_id == user.id,
                    LabEvent.lab_id == lab_id,
                    LabEvent.attempt == attempt,
                    LabEvent.seq == int(str(fields.get("evidence"))),
                )
            )
            picked = picked_result.scalars().first()
        guidance = _submission_guidance(lab, fields, evaluation, picked)
        if not guidance:
            attempt = await current_attempt(db, user.id, lab_id)
            count_result = await db.execute(
                select(func.count()).select_from(LabEvent).where(
                    LabEvent.user_id == user.id,
                    LabEvent.lab_id == lab_id,
                    LabEvent.attempt == attempt,
                    LabEvent.kind == "submission",
                )
            )
            count = int(count_result.scalar_one() or 0)
            hints = list(lab.hints or ())
            if hints and count:
                guidance = hints[min(count, len(hints)) - 1]
    return {
        "evaluation": evaluation,
        "guidance": guidance,
        "lab_id": lab.id,
        "takeaway": dict(lab.takeaway or {}) if met else {},
    }


def _submission_guidance(lab, fields: dict, evaluation: dict | None, picked=None) -> str:
    """Evidence-aware nudge. Specific wrong choices beat the generic ladder.

    ``evidence`` feedback is keyed by what the picked event was (``server:<id>``,
    ``tool:<name>`` or ``kind:<kind>``), never by the expected answer.
    """
    table = getattr(lab, "submission_feedback", None) or {}
    if not isinstance(table, dict):
        return ""
    reason = str((evaluation or {}).get("reason_code") or "")
    detail = str((evaluation or {}).get("reason_detail") or "")
    if reason == "stage_incomplete":
        return str(table.get("_before_evidence") or "")
    if reason == "evidence_mismatch":
        per_evidence = table.get("evidence") if isinstance(table.get("evidence"), dict) else {}
        if picked is not None:
            for key in (f"server:{picked.server_id}", f"tool:{picked.tool}", f"kind:{picked.kind}"):
                if key in per_evidence:
                    return str(per_evidence[key])
        return str(per_evidence.get("_default") or table.get("_default") or "")
    names = [detail] if detail else [str(name) for name in fields]
    for name in names:
        per_field = table.get(name)
        value = str(fields.get(name) or "")
        if isinstance(per_field, dict):
            if value in per_field:
                return str(per_field[value])
            if per_field.get("_default"):
                return str(per_field["_default"])
    return str(table.get("_default") or "")


@router.post("/api/labs/{lab_id}/solution")
async def lab_solution(
    lab_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    lab = await _require_lab(lab_id, user, db)
    await append_events(db, user.id, lab_id, [{
        "kind": "solution_revealed",
        "actor": "learner",
    }])
    result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab_id)
    )
    sess = result.scalar_one_or_none()
    return {
        "solution": lab.solution,
        "completed": bool(sess and sess.completed_at),
        "note": "Reading the solution does not complete this lab.",
    }


@router.post("/api/labs/{lab_id}/decide")
async def lab_decide(
    lab_id: str,
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Record a learner decision. No current lab scores this."""
    await _require_lab(lab_id, user, db)
    choice = str(body.get("choice") or "")
    point = str(body.get("id") or "")
    await append_events(db, user.id, lab_id, [{
        "kind": "decision",
        "actor": "learner",
        "data": {"id": point, "choice": choice},
    }])
    return {"recorded": True, "id": point, "choice": choice}


async def _hint_count(db: AsyncSession, user_id: int, lab_id: str, attempt: int) -> int:
    result = await db.execute(
        select(LabEvent.id).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == lab_id,
            LabEvent.attempt == attempt,
            LabEvent.kind == "hint_revealed",
        )
    )
    return len(result.all())


async def _progress_payload(db: AsyncSession, user: User, lab) -> dict:
    from app.mcp.service import _evaluation

    attempt = await current_attempt(db, user.id, lab.id)
    result = await db.execute(
        select(LabEvent).where(
            LabEvent.user_id == user.id,
            LabEvent.lab_id == lab.id,
            LabEvent.attempt == attempt,
        ).order_by(LabEvent.seq)
    )
    rows = list(result.scalars().all())
    evaluation = await _evaluation(lab.id, "", "", [], db=db, user_id=user.id)
    hints = list(lab.hints or ())
    revealed = sum(1 for row in rows if row.kind == "hint_revealed")
    sess_result = await db.execute(
        select(LabSession).where(LabSession.user_id == user.id, LabSession.lab_id == lab.id)
    )
    sess = sess_result.scalar_one_or_none()
    return {
        "lab_id": lab.id,
        "attempt": attempt,
        "completed": bool(sess and sess.completed_at),
        "solution_revealed": any(row.kind == "solution_revealed" for row in rows),
        "stages": (evaluation or {}).get("stages") or [],
        "reason_code": (evaluation or {}).get("reason_code") or "",
        "hints": hints[:revealed],
        "events": learner_view(rows),
    }
