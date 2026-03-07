from __future__ import annotations


class NotFoundError(Exception):
    pass


class AuthenticationError(Exception):
    pass


class ValidationError(Exception):
    pass


class ForbiddenError(Exception):
    pass


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
