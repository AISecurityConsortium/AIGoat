from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError
from app.core.security import mask_card_number
from app.models import User, UserProfile

router = APIRouter(prefix="", tags=["profile"])


def _profile_to_dict(profile: UserProfile, user: User) -> dict:
    url = None
    if profile.profile_picture:
        url = f"/media/{profile.profile_picture}"
    return {
        "id": profile.id,
        "username": user.username,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "address": profile.address,
        "city": profile.city,
        "state": profile.state,
        "zip_code": profile.zip_code,
        "country": profile.country,
        "profile_picture": profile.profile_picture,
        "profile_picture_url": url,
        "full_name": f"{profile.first_name} {profile.last_name}".strip() or user.username,
        "card_number": mask_card_number(profile.card_number),
        "card_type": profile.card_type,
        "card_holder": profile.card_holder,
        "expiry_month": profile.expiry_month,
        "expiry_year": profile.expiry_year,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


async def _fetch_or_create_profile(
    user: User, db: AsyncSession,
) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(
            user_id=user.id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return _profile_to_dict(profile, user)


@router.get("/api/profile/")
async def get_profile(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await _fetch_or_create_profile(user, db)


@router.get("/api/profile/data/")
async def get_profile_data(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    return await _fetch_or_create_profile(user, db)


@router.put("/api/profile/")
async def update_profile(
    body: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    updatable = {
        "first_name", "last_name", "email", "phone", "address",
        "city", "state", "zip_code", "country",
        "card_number", "card_type", "card_holder", "expiry_month", "expiry_year",
    }
    for k, v in body.items():
        if k in updatable and hasattr(profile, k):
            setattr(profile, k, v)
    await db.commit()
    await db.refresh(profile)
    return _profile_to_dict(profile, user)


@router.post("/api/profile/picture/")
async def upload_profile_picture(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    profile_picture: UploadFile = File(...),
) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    contents = await profile_picture.read()
    filename = f"profile_{user.id}_{profile_picture.filename or 'pic'}"
    from pathlib import Path

    from app.core.config import get_settings
    media_dir = Path(get_settings().app.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    path = media_dir / filename
    path.write_bytes(contents)
    profile.profile_picture = filename
    await db.commit()
    await db.refresh(profile)
    return _profile_to_dict(profile, user)


@router.get("/api/profile/picture/")
async def get_profile_picture_url(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.profile_picture:
        raise NotFoundError("No profile picture")
    return {"url": f"/media/{profile.profile_picture}"}


@router.delete("/api/profile/picture/")
async def delete_profile_picture(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {"success": True}
    profile.profile_picture = None
    await db.commit()
    await db.refresh(profile)
    return {"success": True}
