"""Skills API. Manifests and instructions only; bundled scripts are never executed."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models import User
from app.schemas.skills import SkillInstallIn
from app.skills.runtime import execute_skill

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/")
async def list_skills(user: Annotated[User, Depends(get_current_user)]) -> dict[str, Any]:
    return await execute_skill(user=user, lab_id=None, data={"action": "list"})


@router.get("/converter")
async def converter(
    user: Annotated[User, Depends(get_current_user)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    return await execute_skill(
        user=user,
        lab_id=lab_id,
        data={"action": "converter", "defense_level": defense_level},
    )


@router.get("/{skill_id}/manifest")
async def manifest(
    skill_id: str,
    user: Annotated[User, Depends(get_current_user)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    return await execute_skill(
        user=user,
        lab_id=lab_id,
        data={"action": "manifest", "skill_id": skill_id, "defense_level": defense_level},
    )


@router.post("/{skill_id}/install")
async def install(
    skill_id: str,
    body: SkillInstallIn,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    return await execute_skill(
        user=user,
        lab_id=body.lab_id,
        data={
            "action": "install",
            "skill_id": skill_id,
            "defense_level": body.defense_level,
            "fetch_docs": body.fetch_docs,
        },
    )


@router.get("/{skill_id}/external-doc")
async def external_doc(
    skill_id: str,
    user: Annotated[User, Depends(get_current_user)],
    lab_id: str | None = Query(default=None),
    defense_level: int | None = Query(default=None),
) -> dict[str, Any]:
    return await execute_skill(
        user=user,
        lab_id=lab_id,
        data={"action": "external_doc", "skill_id": skill_id, "defense_level": defense_level},
    )
