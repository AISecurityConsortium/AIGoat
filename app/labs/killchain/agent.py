"""One agent turn, and the approval decision that resumes it.

This reuses the repository's ``GatedAgentLoop``. The lab adds only its tool set, a gate that files
approval requests, and a memory block in the system prompt. If the model does not follow a
poisoned note, the trace says what really happened and nothing is invented.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.loop import GatedAgentLoop
from app.labs.containment import is_halted
from app.labs.killchain import policy
from app.labs.killchain.constants import (
    AGENT_MAX_STEPS,
    LAB_ID,
    MAX_MESSAGE_CHARS,
    PROMPT_FILE,
)
from app.labs.killchain.memory import memory_block, retrieve_for_request, sync_agent_memory
from app.labs.killchain.seed import ensure_baseline
from app.labs.killchain.tools import KillChainGate, ToolContext, build_registry, summarize_result
from app.labs.killchain.trace import KillChainError, emit, new_op_id
from app.models.killchain import KcApproval, KcEvent, KcState
from app.models.user import User
from app.services.ollama_client import get_llm_client

MODEL_NAME = re.compile(r"^[A-Za-z0-9._:/\-]{1,80}$")
MAX_RUNS_KEPT = 30
MAX_CONVERSATION = 24
IMPACT_KINDS = ("approval_required", "exfiltration", "coupon_abuse", "mail_delivered")


@dataclass
class KcRun:
    run_id: str
    user_id: int
    epoch: int
    message: str
    loop: GatedAgentLoop
    ctx: ToolContext
    registry: Any
    retrieved_ids: list[int] = field(default_factory=list)
    poisoned_ids: list[int] = field(default_factory=list)
    status: str = "running"
    mode: str = "vulnerable"


_RUNS: dict[str, KcRun] = {}
_BUSY: set[int] = set()


def cancel_runs(user_id: int) -> int:
    """Forget this user's in-memory runs. Their approvals are removed by the caller."""
    gone = [key for key, run in _RUNS.items() if run.user_id == user_id]
    for key in gone:
        del _RUNS[key]
    return len(gone)


def _remember(run: KcRun) -> None:
    _RUNS[run.run_id] = run
    if len(_RUNS) > MAX_RUNS_KEPT:
        for key in list(_RUNS)[: len(_RUNS) - MAX_RUNS_KEPT]:
            del _RUNS[key]


def base_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8").strip()


def _clean_model(model: str | None) -> str | None:
    text = (model or "").strip()
    if not text:
        return None
    if not MODEL_NAME.match(text):
        raise KillChainError("Unknown model name.")
    return text


def _steps(loop: GatedAgentLoop) -> list[dict[str, Any]]:
    rows = []
    for step in loop.steps:
        if step.action in {"", "finish"}:
            continue
        observation = step.observation or ""
        try:
            parsed: Any = json.loads(observation)
        except ValueError:
            parsed = observation
        rows.append({
            "tool": step.action,
            "arguments": step.action_input or {},
            "decision": step.decision or "",
            "result": summarize_result(step.action, parsed) if isinstance(parsed, dict) else parsed,
        })
    return rows


async def _pending_for(db: AsyncSession, user_id: int, run_id: str) -> KcApproval | None:
    return (await db.execute(
        select(KcApproval).where(
            KcApproval.user_id == user_id, KcApproval.run_id == run_id, KcApproval.status == "pending"
        ).order_by(KcApproval.id.desc())
    )).scalars().first()


async def _save_conversation(db: AsyncSession, user_id: int, *messages: tuple[str, str]) -> None:
    state = (await db.execute(select(KcState).where(KcState.user_id == user_id))).scalar_one()
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    history = list(state.conversation or [])
    history.extend({"role": role, "content": content, "at": stamp} for role, content in messages)
    state.conversation = history[-MAX_CONVERSATION:]
    await db.commit()


async def _finish(db: AsyncSession, run: KcRun, result: Any) -> dict[str, Any]:
    ctx = run.ctx
    payload: dict[str, Any] = {
        "run_id": run.run_id,
        "execution_id": run.run_id,
        "mode": run.mode,
        "steps": _steps(run.loop),
        "retrieved_memory": run.retrieved_ids,
        "pending": None,
        "answer": "",
    }
    if result.terminated_reason == "awaiting_approval":
        run.status = "awaiting_approval"
        approval = await _pending_for(db, ctx.user_id, run.run_id)
        payload.update(status="awaiting_approval", pending=policy.approval_view(approval) if approval else None)
        return payload
    run.status = "completed" if result.success else (result.terminated_reason or "completed")
    answer = result.answer or ""
    payload.update(status=run.status, answer=answer)
    if result.terminated_reason in {"model_error", "tool_error"}:
        await emit(
            db, ctx.user_id, run.run_id, "error",
            "The model request failed" if result.terminated_reason == "model_error" else "A tool call failed",
            status="failed", detail={"reason": result.terminated_reason},
        )
    await emit(
        db, ctx.user_id, run.run_id, "agent_answer", "Agent answered", status="ok",
        detail={"answer": answer, "tool_steps": len(payload["steps"]), "terminated": result.terminated_reason},
    )
    if run.poisoned_ids:
        impact = (await db.execute(
            select(KcEvent.id).where(
                KcEvent.user_id == ctx.user_id, KcEvent.op_id == run.run_id, KcEvent.kind.in_(IMPACT_KINDS),
            ).limit(1)
        )).first()
        if impact is None:
            await emit(
                db, ctx.user_id, run.run_id, "attack_not_triggered",
                "Poisoned memory was in the prompt, but the model did not act on it",
                status="info",
                detail={
                    "memory_ids": run.poisoned_ids,
                    "tools_called": [step["tool"] for step in payload["steps"]],
                    "note": "Local models do not always follow injected instructions. Nothing was simulated on their behalf.",
                },
            )
    await _save_conversation(db, ctx.user_id, ("assistant", answer))
    return payload


async def start_turn(
    db: AsyncSession, user: User, message: str, model: str | None = None
) -> dict[str, Any]:
    text = (message or "").strip()
    if not text:
        raise KillChainError("Type a request first.")
    if len(text) > MAX_MESSAGE_CHARS:
        raise KillChainError("The request is too long.")
    chosen_model = _clean_model(model)
    if is_halted(user.id, LAB_ID):
        raise KillChainError("This lab is halted. Reset it before starting another run.", 409)
    state = await ensure_baseline(db, user.id)
    waiting = (await db.execute(
        select(KcApproval.id).where(KcApproval.user_id == user.id, KcApproval.status == "pending")
    )).first()
    if waiting is not None:
        raise KillChainError("An approval is waiting. Approve or reject it before sending another request.", 409)
    if user.id in _BUSY:
        raise KillChainError("The agent is still working on the previous request.", 409)
    _BUSY.add(user.id)
    try:
        op_id = new_op_id()
        ctx = ToolContext(db=db, user_id=user.id, op_id=op_id, run_id=op_id, epoch=state.epoch)
        await emit(
            db, user.id, op_id, "user_request", "User request received", status="info",
            detail={"message": text, "mode": state.mode, "model": chosen_model or "default"},
        )
        await _save_conversation(db, user.id, ("user", text))
        await sync_agent_memory(db, user.id, op_id, reason="resync")
        retrieved = await retrieve_for_request(db, user.id, op_id, text)
        system = base_prompt()
        block = memory_block(retrieved)
        if block:
            system = f"{system}\n\n{block}"
        registry = build_registry(ctx)
        loop = GatedAgentLoop(
            registry, KillChainGate(registry, ctx), max_steps=AGENT_MAX_STEPS,
            llm=get_llm_client(), system=system, model=chosen_model,
        )
        run = KcRun(
            run_id=op_id, user_id=user.id, epoch=state.epoch, message=text, loop=loop, ctx=ctx,
            registry=registry, retrieved_ids=[row.id for row in retrieved],
            poisoned_ids=[row.id for row in retrieved if row.trust != "trusted"], mode=state.mode,
        )
        _remember(run)
        return await _finish(db, run, await loop.run(text))
    finally:
        _BUSY.discard(user.id)


async def decide(db: AsyncSession, user: User, approval_id: int, decision: str) -> dict[str, Any]:
    if decision not in {"approve", "reject"}:
        raise KillChainError("The decision must be 'approve' or 'reject'.")
    row = (await db.execute(
        select(KcApproval).where(KcApproval.id == approval_id, KcApproval.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise KillChainError("No such approval.", 404)
    if row.status != "pending":
        raise KillChainError(f"Approval {row.id} is already {row.status}.", 409)
    if user.id in _BUSY:
        raise KillChainError("The agent is still working on the previous request.", 409)
    _BUSY.add(user.id)
    try:
        moved = await policy.transition(
            db, user.id, row.id, expect="pending", to="approved" if decision == "approve" else "rejected",
            decided_at=datetime.now(timezone.utc),
        )
        if not moved:
            raise KillChainError(f"Approval {row.id} was already decided.", 409)
        await db.refresh(row)
        run = _RUNS.get(row.run_id)
        live = bool(run and run.user_id == user.id and run.status == "awaiting_approval")
        state = await ensure_baseline(db, user.id)
        if live:
            assert run is not None
            run.ctx.db = db
            ctx, registry = run.ctx, run.registry
        else:
            ctx = ToolContext(db=db, user_id=user.id, op_id=row.execution_id, run_id=row.run_id, epoch=state.epoch)
            registry = build_registry(ctx)
        if decision == "reject":
            await emit(
                db, user.id, row.execution_id, "approval_rejected",
                f"Administrator rejected approval {row.id}. Nothing was executed.",
                status="rejected",
                detail={"approval_id": row.id, "tool": row.tool, "action_type": row.action_type, "executed": False},
                refs={"approval_id": row.id},
            )
            observation = {"error": "The administrator rejected this action. It was not executed."}
            await emit(
                db, user.id, row.execution_id, "tool_result", f"{row.tool}: blocked by the administrator",
                status="blocked", detail={"tool": row.tool, "result": observation},
            )
            decision_label = "deny"
        else:
            await emit(
                db, user.id, row.execution_id, "approval_approved",
                f"Administrator approved approval {row.id}",
                status="approved",
                detail={"approval_id": row.id, "tool": row.tool, "action_type": row.action_type},
                refs={"approval_id": row.id},
            )
            ctx.token = policy.ApprovalToken(approval_id=row.id, args_hash=row.args_hash)
            try:
                observation = await registry.invoke(row.tool, dict(row.arguments or {}))
            finally:
                ctx.token = None
            failed = "error" in observation
            await policy.finalize(db, user.id, row.id, ok=not failed, result=summarize_result(row.tool, observation))
            await emit(
                db, user.id, row.execution_id, "tool_result",
                f"{row.tool}: {'failed' if failed else 'returned'} after approval",
                status="failed" if failed else "ok",
                detail={"tool": row.tool, "result": summarize_result(row.tool, observation)},
                refs={"approval_id": row.id},
            )
            decision_label = "allow"
        await db.refresh(row)
        if not live:
            return {
                "run_id": row.run_id, "execution_id": row.execution_id, "status": "completed_without_agent",
                "answer": "", "steps": [], "pending": None, "approval": policy.approval_view(row),
                "note": "The agent run was no longer in memory, so the decision was applied without a continuation.",
            }
        assert run is not None
        last = run.loop.steps[-1]
        last.observation = json.dumps(observation, default=str)
        last.decision = decision_label
        run.status = "running"
        payload = await _finish(db, run, await run.loop.run(run.message))
        payload["approval"] = policy.approval_view(row)
        return payload
    finally:
        _BUSY.discard(user.id)
