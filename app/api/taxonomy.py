"""Public taxonomy API: frameworks and risks.

Read-only educational metadata. No user data, no database access.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.exceptions import NotFoundError
from app.core.framework_loader import get_all_frameworks, get_all_risks, get_framework_by_id, get_risk_by_id
from app.core.lab_loader import get_lab_by_id
from app.core.taxonomy import challenges_for_risk, coverage_summary, labs_for_risk, related_risks
from app.schemas.taxonomy import (
    ChallengeSummaryOut,
    FrameworkDetailOut,
    FrameworkSummaryOut,
    LabSummaryOut,
    RelatedRiskOut,
    RiskDetailOut,
    RiskOut,
)

router = APIRouter(prefix="", tags=["taxonomy"])


def _challenge_title(challenge_id: int) -> str:
    from app.services.challenge_service import CHALLENGE_DEFINITIONS

    if 1 <= challenge_id <= len(CHALLENGE_DEFINITIONS):
        return str(CHALLENGE_DEFINITIONS[challenge_id - 1].get("title") or f"Challenge {challenge_id}")
    return f"Challenge {challenge_id}"


def _risk_out(risk_id: str, *, code: str, title: str, summary: str, attack_surfaces: tuple[str, ...], related: tuple[str, ...]) -> RiskOut:
    return RiskOut(
        id=risk_id,
        code=code,
        title=title,
        summary=summary,
        attack_surfaces=list(attack_surfaces),
        lab_ids=list(labs_for_risk(risk_id)),
        challenge_ids=list(challenges_for_risk(risk_id)),
        related=list(related),
    )


def _framework_counts() -> dict[str, dict[str, int]]:
    rows = {row["framework_id"]: row for row in coverage_summary()}
    extra: dict[str, dict[str, int]] = {}
    for fw in get_all_frameworks():
        challenge_ids: set[int] = set()
        for risk in fw.risks:
            challenge_ids.update(challenges_for_risk(risk.id))
        row = rows.get(fw.id, {})
        extra[fw.id] = {
            "lab_count": int(row.get("lab_count") or 0),
            "challenge_count": len(challenge_ids),
        }
    return extra


@router.get("/api/frameworks/", response_model=list[FrameworkSummaryOut])
async def list_frameworks() -> list[FrameworkSummaryOut]:
    """List all security frameworks the platform maps labs and challenges to."""
    counts = _framework_counts()
    out: list[FrameworkSummaryOut] = []
    for fw in get_all_frameworks():
        count = counts.get(fw.id, {"lab_count": 0, "challenge_count": 0})
        out.append(
            FrameworkSummaryOut(
                id=fw.id,
                name=fw.name,
                version=fw.version,
                status=fw.status,
                published=fw.published,
                publisher=fw.publisher,
                url=fw.url,
                risk_count=len(fw.risks),
                supersedes=fw.supersedes,
                lab_count=count["lab_count"],
                challenge_count=count["challenge_count"],
            )
        )
    return out


@router.get("/api/frameworks/{framework_id}", response_model=FrameworkDetailOut)
async def get_framework(framework_id: str) -> FrameworkDetailOut:
    """Return one framework with its risks, attribution, and maturity warning."""
    fw = get_framework_by_id(framework_id)
    if fw is None:
        raise NotFoundError(f"Framework {framework_id} not found")
    risks = [
        _risk_out(
            risk.id,
            code=risk.code,
            title=risk.title,
            summary=risk.summary,
            attack_surfaces=risk.attack_surfaces,
            related=risk.related,
        )
        for risk in fw.risks
    ]
    return FrameworkDetailOut(
        id=fw.id,
        name=fw.name,
        version=fw.version,
        status=fw.status,
        published=fw.published,
        publisher=fw.publisher,
        url=fw.url,
        attribution=fw.attribution,
        source_license=fw.source_license,
        maturity_note=fw.maturity_note,
        supersedes=fw.supersedes,
        risks=risks,
    )


@router.get("/api/risks/", response_model=list[RiskOut])
async def list_risks(
    framework: str | None = Query(default=None),
    surface: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[RiskOut]:
    """List risks across frameworks. Optional filters combine with AND."""
    needle = q.strip().lower() if q else None
    out: list[RiskOut] = []
    for risk in get_all_risks():
        if framework and risk.framework_id != framework:
            continue
        if surface and surface not in risk.attack_surfaces:
            continue
        if needle:
            haystack = f"{risk.code} {risk.title} {risk.summary}".lower()
            if needle not in haystack:
                continue
        out.append(
            _risk_out(
                risk.id,
                code=risk.code,
                title=risk.title,
                summary=risk.summary,
                attack_surfaces=risk.attack_surfaces,
                related=risk.related,
            )
        )
    return out


@router.get("/api/risks/{risk_id:path}", response_model=RiskDetailOut)
async def get_risk(risk_id: str) -> RiskDetailOut:
    """Return one fully expanded risk, including labs, challenges, and related risks."""
    risk = get_risk_by_id(risk_id)
    if risk is None:
        raise NotFoundError(f"Risk {risk_id} not found")
    lab_ids = labs_for_risk(risk.id)
    challenge_ids = challenges_for_risk(risk.id)
    labs = []
    for lab_id in lab_ids:
        lab = get_lab_by_id(lab_id)
        if lab is None:
            continue
        labs.append(LabSummaryOut(id=lab.id, name=lab.name, status=lab.status, surface=lab.surface))
    challenges = [ChallengeSummaryOut(id=cid, title=_challenge_title(cid)) for cid in challenge_ids]
    related_out: list[RelatedRiskOut] = []
    for related in related_risks(risk.id):
        related_fw = get_framework_by_id(related.framework_id)
        related_out.append(
            RelatedRiskOut(
                id=related.id,
                code=related.code,
                title=related.title,
                framework_id=related.framework_id,
                framework_name=related_fw.name if related_fw else related.framework_id,
            )
        )
    base = _risk_out(
        risk.id,
        code=risk.code,
        title=risk.title,
        summary=risk.summary,
        attack_surfaces=risk.attack_surfaces,
        related=risk.related,
    )
    return RiskDetailOut(
        **base.model_dump(),
        description=risk.description,
        references=[],
        labs=labs,
        challenges=challenges,
        related_risks=related_out,
    )
