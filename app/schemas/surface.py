from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SurfaceExecuteIn(BaseModel):
    lab_id: str | None = None
    session_token: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class SurfaceDefenseOut(BaseModel):
    level: int
    surface: str
    controls_applied: list[str]
    outcomes: list[dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SurfaceEvaluationOut(BaseModel):
    exploit_triggered: bool
    evaluator: str | None = None
    flag: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SurfaceExecuteOut(BaseModel):
    result: dict[str, Any]
    transcript: list[dict[str, Any]]
    defense: SurfaceDefenseOut
    evaluation: SurfaceEvaluationOut | None = None

    model_config = ConfigDict(from_attributes=True)


class SurfaceSummaryOut(BaseModel):
    id: str
    name: str
    ui: str
    capabilities: list[str]
    available: bool
    reason: str | None = None

    model_config = ConfigDict(from_attributes=True)
