from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

if TYPE_CHECKING:
    from fastapi import FastAPI, Request, Response

logger = logging.getLogger(__name__)

PUBLIC_PATH_PREFIXES = (
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/verify-otp",
    "/api/auth/demo-users",
    "/api/features",
    "/api/ollama/status",
    "/api/products",
    "/api/search",
    "/media/",
    "/docs",
    "/redoc",
    "/openapi.json",
)

PROTECTED_PATH_PREFIXES = (
    "/api/cart",
    "/api/checkout",
    "/api/orders",
    "/api/profile",
    "/api/admin",
    "/api/chat",
    "/api/rag",
    "/api/knowledge-base",
    "/api/workshop",
    "/api/labs",
    "/api/tips",
    "/api/coupons",
    "/api/reviews",
)


def _is_public(path: str) -> bool:
    for prefix in PUBLIC_PATH_PREFIXES:
        if path.rstrip("/").startswith(prefix.rstrip("/")):
            return True
    return False


def _is_protected(path: str) -> bool:
    for prefix in PROTECTED_PATH_PREFIXES:
        if path.rstrip("/").startswith(prefix.rstrip("/")):
            return True
    return False


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: "Request", call_next) -> "Response":
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token:
                username: str | None = None
                from app.core.security import verify_demo_token, verify_token
                demo = verify_demo_token(token)
                if demo:
                    username = demo
                else:
                    payload = verify_token(token)
                    if payload:
                        username = payload.get("sub") or payload.get("username")

                if username:
                    request.state.token_username = username
                    request.state.token_raw = token
                elif _is_protected(path):
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid or expired token"},
                    )
        elif _is_protected(path) and not _is_public(path):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authorization header"},
            )

        return await call_next(request)


def setup_auth_middleware(app: "FastAPI") -> None:
    app.add_middleware(JWTAuthMiddleware)
