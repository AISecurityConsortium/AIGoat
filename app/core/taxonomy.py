"""In-memory taxonomy index: labs, challenges, and related risks per risk id."""
from __future__ import annotations

import logging
import time
from typing import Any

from app.core.framework_loader import Framework, Risk, get_all_frameworks, get_all_risks, get_risk_by_id
from app.core.lab_loader import get_all_labs

logger = logging.getLogger(__name__)

_index: dict[str, Any] | None = None


def reset_index() -> None:
    global _index
    _index = None


def _challenge_risk_map() -> dict[int, tuple[str, ...]]:
    from app.services.challenge_service import CHALLENGE_DEFINITIONS

    mapping: dict[int, list[str]] = {}
    for challenge_id, spec in enumerate(CHALLENGE_DEFINITIONS, start=1):
        raw = spec.get("owasp_ref") or ""
        resolved: list[str] = []
        for part in str(raw).split("+"):
            code = part.strip()
            if not code:
                continue
            qualified = f"owasp-llm-2025:{code}"
            if get_risk_by_id(qualified) is None:
                logger.warning("challenge %s owasp_ref %r does not resolve", challenge_id, qualified)
                continue
            resolved.append(qualified)
        mapping[challenge_id] = resolved
    return {cid: tuple(ids) for cid, ids in mapping.items()}


def _build() -> dict[str, Any]:
    frameworks = get_all_frameworks()
    risks = get_all_risks()
    known = {risk.id: risk for risk in risks}
    labs = get_all_labs()

    for risk in risks:
        for related_id in risk.related:
            if related_id not in known:
                raise ValueError(f"risk {risk.id} related {related_id} does not resolve")

    labs_by_risk: dict[str, list[str]] = {risk_id: [] for risk_id in known}
    risks_by_lab: dict[str, list[Risk]] = {}
    for lab in labs:
        lab_risks: list[Risk] = []
        for risk_id in lab.risks:
            risk = known.get(risk_id)
            if risk is None:
                raise ValueError(f"lab {lab.id} references unknown risk {risk_id}")
            lab_risks.append(risk)
            if lab.id not in labs_by_risk.setdefault(risk_id, []):
                labs_by_risk[risk_id].append(lab.id)
        risks_by_lab[lab.id] = lab_risks

    challenges_by_risk: dict[str, list[int]] = {risk_id: [] for risk_id in known}
    for challenge_id, risk_ids in _challenge_risk_map().items():
        for risk_id in risk_ids:
            challenges_by_risk.setdefault(risk_id, []).append(challenge_id)

    related_by_risk: dict[str, tuple[Risk, ...]] = {}
    for risk in risks:
        related_by_risk[risk.id] = tuple(known[related_id] for related_id in risk.related)

    covered: dict[str, set[str]] = {fw.id: set() for fw in frameworks}
    labs_per_framework: dict[str, set[str]] = {fw.id: set() for fw in frameworks}
    for lab in labs:
        if lab.status != "active":
            continue
        for risk in risks_by_lab.get(lab.id, []):
            covered[risk.framework_id].add(risk.id)
            labs_per_framework[risk.framework_id].add(lab.id)

    summary = [
        {
            "framework_id": fw.id,
            "risk_count": len(fw.risks),
            "covered_risk_count": len(covered[fw.id]),
            "lab_count": len(labs_per_framework[fw.id]),
        }
        for fw in frameworks
    ]

    return {
        "labs_by_risk": {k: tuple(v) for k, v in labs_by_risk.items()},
        "risks_by_lab": {k: tuple(v) for k, v in risks_by_lab.items()},
        "challenges_by_risk": {k: tuple(v) for k, v in challenges_by_risk.items()},
        "related_by_risk": related_by_risk,
        "summary": summary,
        "frameworks": frameworks,
    }


def build_index() -> dict[str, Any]:
    global _index
    if _index is not None:
        return _index
    started = time.perf_counter()
    _index = _build()
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info("Taxonomy index built in %.1f ms", elapsed_ms)
    return _index


def labs_for_risk(risk_id: str) -> tuple[str, ...]:
    return build_index()["labs_by_risk"].get(risk_id, ())


def risks_for_lab(lab_id: str) -> tuple[Risk, ...]:
    return build_index()["risks_by_lab"].get(lab_id, ())


def challenges_for_risk(risk_id: str) -> tuple[int, ...]:
    return build_index()["challenges_by_risk"].get(risk_id, ())


def related_risks(risk_id: str) -> tuple[Risk, ...]:
    return build_index()["related_by_risk"].get(risk_id, ())


def coverage_summary() -> list[dict[str, Any]]:
    return list(build_index()["summary"])


def frameworks() -> tuple[Framework, ...]:
    return build_index()["frameworks"]
