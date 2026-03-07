from __future__ import annotations

import hashlib
import hmac as _hmac
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any]) -> str:
    settings = get_settings()
    return jwt.encode(
        data,
        settings.app.secret_key,
        algorithm="HS256",
    )


def verify_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.app.secret_key,
            algorithms=["HS256"],
        )
        return payload
    except JWTError:
        return None


def _demo_signature(username: str, user_id: int, secret_key: str) -> str:
    payload = f"demo:{username}:{user_id}".encode("utf-8")
    return _hmac.new(
        secret_key.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()[:32]


def create_demo_token(username: str, user_id: int) -> str:
    """Create an HMAC-signed demo token.  Format: demo:username:id:signature"""
    settings = get_settings()
    sig = _demo_signature(username, user_id, settings.app.secret_key)
    return f"demo:{username}:{user_id}:{sig}"


def verify_demo_token(token: str) -> str | None:
    """Verify an HMAC-signed demo token.

    Returns the username on success, None on failure.
    Uses constant-time comparison to prevent timing attacks.
    """
    parts = token.split(":")
    if len(parts) != 4 or parts[0] != "demo":
        return None
    username = parts[1]
    try:
        user_id = int(parts[2])
    except (ValueError, IndexError):
        return None
    submitted_sig = parts[3]
    settings = get_settings()
    expected_sig = _demo_signature(username, user_id, settings.app.secret_key)
    if _hmac.compare_digest(submitted_sig, expected_sig):
        return username
    return None


def mask_card_number(number: str | None) -> str:
    """Mask a card number, showing only the last 4 digits."""
    if not number or len(number) < 4:
        return "****"
    return "*" * (len(number) - 4) + number[-4:]
