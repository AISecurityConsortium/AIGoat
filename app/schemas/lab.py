"""Pydantic response models for the labs API."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LabOut(BaseModel):
    id: str
    name: str
    owasp: str
    status: str
    defense_override: int | None = None
    description: str
    started_at: str | None = None
    completed_at: str | None = None
    reset_count: int = 0
    risks: list[str] = Field(default_factory=list)
    primary_risk: str = ""
    surface: str
    difficulty: str
    objective: str = ""
    prerequisites: list[str] = Field(default_factory=list)
    attack_steps: list[str] = Field(default_factory=list)
    example_payloads: list[str] = Field(default_factory=list)
    expected_by_level: dict[str, str] = Field(
        default_factory=dict,
        description='Per-defense-level expected behaviour. JSON keys are "0", "1", "2".',
    )
    remediation: str = ""
    references: list[str] = Field(default_factory=list)
    challenge_id: int | None = None
    related_lab_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LabStartOut(BaseModel):
    lab_id: str
    started_at: str
    surface: str
    already_started: bool
