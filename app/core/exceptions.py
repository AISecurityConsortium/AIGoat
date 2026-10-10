from __future__ import annotations


class NotFoundError(Exception):
    pass


class AuthenticationError(Exception):
    pass


class ValidationError(Exception):
    pass


class ForbiddenError(Exception):
    pass


class SurfaceNotReadyError(Exception):
    """Surface is registered but execute is not implemented yet (P7+)."""

    def __init__(self, surface_id: str, reason: str) -> None:
        self.surface_id = surface_id
        self.reason = reason
        super().__init__(reason)


class McpSpawnError(Exception):
    """Stdio MCP subprocess timed out or failed to speak the protocol."""

    def __init__(self, server_id: str, reason: str, status_code: int = 504) -> None:
        self.server_id = server_id
        self.reason = reason
        self.status_code = status_code
        super().__init__(reason)


def register_exception_handlers(app) -> None:
    from fastapi import Request
    from fastapi.responses import JSONResponse

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"detail": str(exc) or "Resource not found"},
        )

    @app.exception_handler(AuthenticationError)
    async def auth_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": str(exc) or "Authentication required"},
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": str(exc) or "Validation error"},
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content={"detail": str(exc) or "Forbidden"},
        )

    @app.exception_handler(SurfaceNotReadyError)
    async def surface_not_ready_handler(
        request: Request, exc: SurfaceNotReadyError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=501,
            content={"detail": str(exc) or "Surface not ready"},
        )

    @app.exception_handler(McpSpawnError)
    async def mcp_spawn_handler(request: Request, exc: McpSpawnError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.reason, "server_id": exc.server_id},
        )
