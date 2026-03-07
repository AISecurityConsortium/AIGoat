from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    error: str

    model_config = ConfigDict(from_attributes=True)


class SuccessResponse(BaseModel):
    success: bool
    message: str | None = None

    model_config = ConfigDict(from_attributes=True)
