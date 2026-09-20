"""skill.runtime install overlay. Instructions interpreted; scripts never executed."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.agent.tools import SHOP_TOOL_NAMES
from app.challenges.evaluator import EvalContext
from app.challenges.registry import get_evaluator_by_title
from app.core.exceptions import ValidationError
from app.core.lab_loader import get_lab_by_id
from app.defense.chain import run_chain
from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.profiles import resolve_profile
from app.skills.docs import next_external_doc
from app.skills.parser import LoadedSkill
from app.skills.registry import get_skill, load_all_skills, load_skill_path, reset_skill_cache
from app.surfaces.transcript import Transcript

SURFACE = "skill.runtime"

_INSTALLS: dict[tuple[int, str], "SkillInstall"] = {}


@dataclass
class SkillInstall:
    skill_id: str
    lab_id: str
    user_id: int
    level: int
    declared_tools: tuple[str, ...]
    granted_tools: tuple[str, ...]
    instructions: str
    description: str
    content_hash: str
    bundled: list[dict[str, Any]]
    metadata: dict[str, str] = field(default_factory=dict)
    trust_tier: str = "community"
    external_doc: dict[str, str] | None = None
    outcomes: list[dict[str, Any]] = field(default_factory=list)
    denied: bool = False
    deny_reason: str | None = None
    isolation_mode: str = "restricted"
    pinned_hash: str | None = None
    pinned_mismatch: bool = False
    installed_at: str = ""
    converter: dict[str, Any] | None = None


class _SkillRuntime:
    async def load(self, path) -> LoadedSkill:
        return load_skill_path(path)


def get_skill_runtime() -> _SkillRuntime:
    return _SkillRuntime()


def reset_installs() -> None:
    _INSTALLS.clear()
    reset_skill_cache()


def get_install(user_id: int, lab_id: str) -> SkillInstall | None:
    return _INSTALLS.get((user_id, lab_id))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _outcomes_from_chain(outcomes) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for outcome in outcomes:
        if not outcome.control_id:
            continue
        try:
            stages = get_control(outcome.control_id).applies_to
        except KeyError:
            stages = ()
        stage = stages[0].value if stages else "skill_load"
        out.append({
            "control_id": outcome.control_id,
            "action": outcome.action.value,
            "stage": stage,
            "reason": outcome.reason,
        })
    return out


def _trust_tier(skill: LoadedSkill) -> str:
    return skill.metadata.get("trust_tier") or "community"


def serialize_skill(skill: LoadedSkill) -> dict[str, Any]:
    return {
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "allowed_tools": list(skill.allowed_tools),
        "license": skill.license,
        "compatibility": skill.compatibility,
        "metadata": skill.metadata,
        "content_hash": skill.content_hash,
        "trust_tier": _trust_tier(skill),
        "bundled_scripts": [
            {
                "path": item.relative,
                "size": item.size,
                "sha256": item.sha256,
                "executed": False,
                "disposition": item.disposition,
            }
            for item in skill.bundled_files
        ],
        "scripts_executed": False,
        "unsafe_yaml_refused": skill.unsafe_yaml_refused,
    }


def serialize_manifest(skill: LoadedSkill) -> dict[str, Any]:
    payload = serialize_skill(skill)
    payload["instructions"] = skill.instructions
    payload["never_executes_bundled_scripts"] = True
    return payload


def converter_diff() -> dict[str, Any]:
    return {
        "source": {"allowed-tools": "lookup_order", "compatibility": "restricted"},
        "converted": {"allowed-tools": None, "compatibility": None},
        "dropped": ["allowed-tools", "compatibility"],
        "note": "A converter that only copies name and description drops the permission field.",
    }


def resolve_skill_level(data: dict[str, Any], user: Any, lab_id: str | None) -> int:
    lab = get_lab_by_id(lab_id) if lab_id else None
    if data.get("defense_level") is not None:
        return int(data["defense_level"])
    if lab and lab.defense_override is not None:
        return int(lab.defense_override)
    return int(getattr(user, "defense_level", 0) or 0)


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


def _defense_dict(level: int, outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    profile = resolve_profile(SURFACE, level) if level >= 1 else None
    return {
        "level": level,
        "surface": SURFACE,
        "controls_applied": list(profile.controls) if profile else [],
        "outcomes": outcomes,
    }


def skill_load_event_data(install: SkillInstall) -> dict[str, Any]:
    return {
        "skill_id": install.skill_id,
        "declared_tools": list(install.declared_tools),
        "granted_tools": list(install.granted_tools),
        "trust_tier": install.trust_tier,
        "metadata": dict(install.metadata),
        "content_hash": install.content_hash,
        "pinned_hash": install.pinned_hash,
        "pinned_mismatch": install.pinned_mismatch,
        "isolation_mode": install.isolation_mode,
        "bundled_executed": False,
        "denied": install.denied,
        "deny_reason": install.deny_reason,
        "external_doc": install.external_doc,
        "converter": install.converter,
        "installed_at": install.installed_at,
        "user_id": install.user_id,
    }


def transcript_for_install(install: SkillInstall, *, goal: str = "") -> list[dict[str, Any]]:
    transcript = Transcript()
    if goal:
        transcript.add("user_message", content=goal, raw=goal)
    data = skill_load_event_data(install)
    transcript.add(
        "skill_load",
        raw=install.instructions,
        transformed=install.instructions,
        **data,
    )
    return transcript.to_api()


async def install_skill(
    *,
    user_id: int,
    lab_id: str | None,
    skill_id: str,
    level: int,
    fetch_docs: bool = False,
) -> SkillInstall:
    skill = get_skill(skill_id)
    lab = get_lab_by_id(lab_id) if lab_id else None
    config = (lab.surface_config if lab else None) or {}
    declared = tuple(t for t in skill.allowed_tools if t in SHOP_TOOL_NAMES)
    granted = tuple(SHOP_TOOL_NAMES) if level <= 0 else declared
    pinned_body = config.get("pinned_body")
    pinned_hash = config.get("pinned_hash")
    if pinned_body and not pinned_hash:
        pinned_hash = _hash_text(str(pinned_body))
    pinned_mismatch = bool(pinned_hash) and str(pinned_hash) != skill.content_hash
    instructions = skill.instructions
    context = {
        "declared_tools": list(declared),
        "granted_tools": list(granted),
        "content_hash": skill.content_hash,
        "pinned_body": pinned_body,
        "pinned_hash": pinned_hash,
        "pinned_mismatch": pinned_mismatch,
        "skill_id": skill_id,
    }
    outcomes: list[dict[str, Any]] = []
    denied = False
    deny_reason = None
    if level >= 1:
        profile = resolve_profile(SURFACE, level)
        decision = DefenseDecision(
            surface=SURFACE,
            stage=DefenseStage.SKILL_LOAD,
            payload=instructions,
            level=level,
            context=context,
            user_id=user_id,
        )
        chain = await run_chain(list(profile.controls), decision)
        outcomes = _outcomes_from_chain(chain.outcomes)
        granted = tuple(decision.context.get("granted_tools") or granted)
        pinned_mismatch = bool(decision.context.get("pinned_mismatch") or pinned_mismatch)
        if chain.final.action is ControlAction.TRANSFORM:
            instructions = chain.final.payload
        if chain.final.action is ControlAction.DENY:
            denied = True
            deny_reason = chain.final.reason
            granted = ()
    external = None
    wants_docs = fetch_docs or bool(config.get("fetch_external_doc"))
    if wants_docs and not denied:
        external = next_external_doc(skill_id)
        instructions = instructions + "\n\nEXTERNAL DOC\n" + external["text"]
    isolation = "host" if level <= 0 else "restricted"
    record = SkillInstall(
        skill_id=skill_id,
        lab_id=lab_id or "",
        user_id=user_id,
        level=level,
        declared_tools=declared,
        granted_tools=granted,
        instructions=instructions,
        description=skill.description,
        content_hash=skill.content_hash,
        bundled=[
            {
                "path": item.relative,
                "size": item.size,
                "sha256": item.sha256,
                "executed": False,
                "disposition": item.disposition,
            }
            for item in skill.bundled_files
        ],
        metadata=dict(skill.metadata),
        trust_tier=_trust_tier(skill),
        external_doc=external,
        outcomes=outcomes,
        denied=denied,
        deny_reason=deny_reason,
        isolation_mode=isolation,
        pinned_hash=str(pinned_hash) if pinned_hash else None,
        pinned_mismatch=pinned_mismatch,
        installed_at=_now(),
    )
    if lab_id:
        _INSTALLS[(user_id, lab_id)] = record
    return record


def overlay_system(base: str, install: SkillInstall | None) -> str:
    if install is None or install.denied:
        return base
    return (
        base
        + "\n\nINSTALLED SKILL "
        + install.skill_id
        + "\n"
        + install.description
        + "\n\n"
        + install.instructions
    )


def overlay_allowlist(lab_allowlist: list[str] | None, install: SkillInstall | None) -> list[str] | None:
    if install is None or install.denied:
        return lab_allowlist
    granted = list(install.granted_tools)
    if lab_allowlist is None:
        return granted
    allowed = set(lab_allowlist)
    return [name for name in granted if name in allowed] or granted


def _skill_id_for(lab, data: dict[str, Any]) -> str:
    if data.get("skill_id"):
        return str(data["skill_id"])
    if lab:
        configured = (lab.surface_config or {}).get("skill_id")
        if configured:
            return str(configured)
    raise ValidationError("skill_id is required")


async def execute_skill(
    *,
    user: Any,
    lab_id: str | None,
    data: dict[str, Any],
) -> dict[str, Any]:
    op = str(data.get("action") or data.get("op") or "install")
    if op not in {"list", "manifest", "install", "external_doc", "converter"}:
        raise ValidationError(f"unknown skill action {op!r}")
    level = resolve_skill_level(data, user, lab_id)
    lab = get_lab_by_id(lab_id) if lab_id else None

    if op == "list":
        skills = [serialize_skill(item) for item in load_all_skills()]
        return {
            "result": {"skills": skills, "never_executes_bundled_scripts": True},
            "transcript": [],
            "defense": _defense_dict(level, []),
            "evaluation": None,
        }

    if op == "converter":
        diff = converter_diff()
        skill_id = str(data.get("skill_id") or ((lab.surface_config or {}).get("skill_id") if lab else "") or "refund-helper")
        install = await install_skill(
            user_id=user.id,
            lab_id=lab_id,
            skill_id=skill_id,
            level=level,
        )
        install.converter = diff
        transcript = transcript_for_install(install, goal="converter")
        return {
            "result": {**serialize_skill(get_skill(skill_id)), "converter": diff},
            "transcript": transcript,
            "defense": _defense_dict(level, install.outcomes),
            "evaluation": _evaluation(lab_id, "converter", "", transcript),
        }

    skill_id = _skill_id_for(lab, data)
    if op == "manifest":
        skill = get_skill(skill_id)
        payload = serialize_manifest(skill)
        transcript = Transcript()
        transcript.add("skill_load", raw=skill.instructions, **{
            "skill_id": skill.id,
            "declared_tools": list(skill.allowed_tools),
            "granted_tools": list(skill.allowed_tools),
            "trust_tier": _trust_tier(skill),
            "metadata": dict(skill.metadata),
            "content_hash": skill.content_hash,
            "bundled_executed": False,
        })
        api = transcript.to_api()
        return {
            "result": payload,
            "transcript": api,
            "defense": _defense_dict(level, []),
            "evaluation": _evaluation(lab_id, "manifest", skill.instructions, api),
        }

    fetch_docs = op == "external_doc" or bool(data.get("fetch_docs"))
    install = await install_skill(
        user_id=user.id,
        lab_id=lab_id,
        skill_id=skill_id,
        level=level,
        fetch_docs=fetch_docs,
    )
    transcript = transcript_for_install(install, goal=op)
    result = {
        "skill_id": install.skill_id,
        "declared_tools": list(install.declared_tools),
        "granted_tools": list(install.granted_tools),
        "instructions": install.instructions,
        "description": install.description,
        "content_hash": install.content_hash,
        "bundled_scripts": install.bundled,
        "scripts_executed": False,
        "never_executes_bundled_scripts": True,
        "trust_tier": install.trust_tier,
        "metadata": install.metadata,
        "external_doc": install.external_doc,
        "denied": install.denied,
        "deny_reason": install.deny_reason,
        "isolation_mode": install.isolation_mode,
        "pinned_mismatch": install.pinned_mismatch,
        "pinned_hash": install.pinned_hash,
        "installed_at": install.installed_at,
        "user_id": install.user_id,
    }
    return {
        "result": result,
        "transcript": transcript,
        "defense": _defense_dict(level, install.outcomes),
        "evaluation": _evaluation(lab_id, op, install.instructions, transcript),
    }
