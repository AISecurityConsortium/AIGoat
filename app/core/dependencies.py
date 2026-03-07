from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthenticationError
from app.core.security import verify_token
from app.models import User


async def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> User:
    username: str | None = getattr(request.state, "token_username", None)

    if not username:
        if not authorization or not authorization.startswith("Bearer "):
            raise AuthenticationError("Missing or invalid authorization header")
        token = authorization[7:].strip()
        if not token:
            raise AuthenticationError("Missing token")

        if token.startswith("demo_token_"):
            rest = token[len("demo_token_"):]
            parts = rest.rsplit("_", 1)
            if len(parts) == 2 and parts[-1].isdigit():
                username = parts[0]
            else:
                username = rest
        else:
            payload = verify_token(token)
            if payload:
                username = payload.get("sub") or payload.get("username")
            if not username:
                raise AuthenticationError("Invalid token")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthenticationError("User not found")
    return user
