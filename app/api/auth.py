from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_demo_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import (
    DemoUserResponse,
    LoginRequest,
    LoginResponse,
    SignupRequest,
)

router = APIRouter(prefix="", tags=["auth"])

DEMO_USERS = ["alice", "bob", "charlie", "frank", "admin"]


@router.post("/api/auth/login/", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    """Authenticate a user with username and password. Returns a JWT token."""
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_demo_token(user.username, user.id)
    return LoginResponse(token=token)


@router.post("/api/auth/signup/")
async def signup(
    body: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a new user account. Returns a JWT token on success."""
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    email = body.email or f"{body.username}@example.com"
    password = body.password or body.username
    user = User(
        username=body.username,
        email=email,
        password_hash=hash_password(password),
        first_name=body.first_name or "",
        last_name=body.last_name or "",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_demo_token(user.username, user.id)
    return {
        "success": True,
        "token": token,
        "user": {
            "username": user.username,
            "id": user.id,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
        },
    }


@router.post("/api/auth/verify-otp/")
async def verify_otp(
    body: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Verify a one-time password for a user. Demo OTP: any 4+ digit code is accepted."""
    username = body.get("username")
    otp = body.get("otp")
    if not username or not otp:
        raise HTTPException(status_code=400, detail="Username and OTP are required")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if otp == "000000" or len(str(otp)) >= 4:
        return {"success": True, "message": "OTP verified successfully"}
    raise HTTPException(status_code=400, detail="Invalid OTP")


@router.get("/api/auth/demo-users/")
async def list_demo_users(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """List pre-seeded demo user accounts with ready-to-use tokens for the login page."""
    result = await db.execute(
        select(User)
        .where(User.username.in_(DEMO_USERS))
        .order_by(User.username)
    )
    users = result.scalars().all()
    demo_users = [
        DemoUserResponse(
            username=u.username,
            email=u.email,
            is_staff=u.is_staff,
            first_name=u.first_name or "",
            last_name=u.last_name or "",
            demo_token=create_demo_token(u.username, u.id),
            is_demo=u.username in ["alice", "bob", "charlie", "frank"],
            is_admin=u.username == "admin",
        )
        for u in users
    ]
    return {"users": [u.model_dump() for u in demo_users]}
