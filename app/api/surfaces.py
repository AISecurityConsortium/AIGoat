"""Generic surface list and execute API (P6)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.models import User
from app.schemas.surface import (
    SurfaceEvaluationOut,
    SurfaceExecuteIn,
    SurfaceExecuteOut,
    SurfaceSummaryOut,
)
from app.surfaces import ensure_registered
from app.surfaces.base import SurfaceRequest
from app.surfaces.registry import all_surfaces, get_surface

router = APIRouter(prefix="/api/surfaces", tags=["surfaces"])


def _enabled_ids() -> set[str]:
    return set(get_settings().surfaces.enabled)


@router.get("/", response_model=list[SurfaceSummaryOut])
async def list_surfaces(
    user: Annotated[User, Depends(get_current_user)],
) -> list[SurfaceSummaryOut]:
    ensure_registered()
    enabled = _enabled_ids()
    out: list[SurfaceSummaryOut] = []
    for surface in all_surfaces():
        if surface.id not in enabled:
            continue
        available, reason = surface.availability()
        out.append(
            SurfaceSummaryOut(
                id=surface.id,
                name=surface.name,
                ui=surface.ui,
                capabilities=list(surface.capabilities),
                available=available,
                reason=reason,
            )
        )
    return out


@router.post("/{surface_id}/execute", response_model=SurfaceExecuteOut)
async def execute_surface(
    surface_id: str,
    body: SurfaceExecuteIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SurfaceExecuteOut:
    ensure_registered()
    if surface_id not in _enabled_ids():
        raise NotFoundError(f"Surface {surface_id} not found")
    try:
        surface = get_surface(surface_id)
    except KeyError as exc:
        raise NotFoundError(f"Surface {surface_id} not found") from exc

    result = await surface.execute(
        SurfaceRequest(
            user=user,
            db=db,
            lab_id=body.lab_id,
            session_token=body.session_token,
            input=body.input,
        )
    )
    evaluation = None
    if result.evaluation is not None:
        evaluation = SurfaceEvaluationOut.model_validate(result.evaluation)
    return SurfaceExecuteOut(
        result=result.result,
        transcript=result.transcript_api(),
        defense=result.defense,
        evaluation=evaluation,
    )
