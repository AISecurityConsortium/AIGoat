"""Dynamic flag engine.

Derives a per-deployment runtime secret from the application secret key
and a compile-time salt.  Flags are never stored — they are recomputed
on demand from (challenge_id, user_id).
"""
from __future__ import annotations

import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)

_INTERNAL_SALT = b"aigoat:challenge:v1"

_runtime_secret: bytes | None = None


def init_flag_engine(secret_key: str) -> None:
    """Derive the runtime secret once at application startup."""
    global _runtime_secret
    _runtime_secret = hmac.new(
        secret_key.encode("utf-8"),
        _INTERNAL_SALT,
        hashlib.sha256,
    ).digest()


def _get_runtime_secret() -> bytes:
    if _runtime_secret is None:
        raise RuntimeError("FlagEngine not initialised — call init_flag_engine() at startup")
    return _runtime_secret


def compute_flag(challenge_id: int, user_id: int) -> str:
    """Deterministic per-user flag.  Format: AIGOAT{<32 hex chars uppercase>}"""
    payload = f"{challenge_id}:{user_id}".encode("utf-8")
    digest = hmac.new(_get_runtime_secret(), payload, hashlib.sha256).hexdigest()
    return f"AIGOAT{{{digest[:32].upper()}}}"


def verify_flag(challenge_id: int, user_id: int, submitted: str) -> bool:
    expected = compute_flag(challenge_id, user_id)
    return hmac.compare_digest(submitted.strip(), expected)
