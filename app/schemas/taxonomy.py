"""Pydantic response models for the public taxonomy API."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FrameworkSummaryOut(BaseModel):
    id: str
    name: str
    version: str
    status: str
    published: str | None = None
    publisher: str
    url: str
    risk_count: int
    supersedes: str | None = None
    lab_count: int
    challenge_count: int

    model_config = ConfigDict(from_attributes=True)


class RiskOut(BaseModel):
    id: str
    code: str
    title: str
    summary: str
    attack_surfaces: list[str]
    lab_ids: list[str]
    challenge_ids: list[int]
    related: list[str]

    model_config = ConfigDict(from_attributes=True)


class FrameworkDetailOut(BaseModel):
    id: str
    name: str
    version: str
    status: str
    published: str | None = None
    publisher: str
    url: str
    attribution: str
    source_license: str
    maturity_note: str | None = None
    supersedes: str | None = None
    risks: list[RiskOut]

    model_config = ConfigDict(from_attributes=True)


class LabSummaryOut(BaseModel):
    id: str
    name: str
    status: str
    surface: str = "chat.cracky"

    model_config = ConfigDict(from_attributes=True)


class ChallengeSummaryOut(BaseModel):
    id: int
    title: str

    model_config = ConfigDict(from_attributes=True)


class RelatedRiskOut(BaseModel):
    id: str
    code: str
    title: str
    framework_id: str
    framework_name: str

    model_config = ConfigDict(from_attributes=True)


class RiskDetailOut(RiskOut):
    description: str
    references: list[str] = Field(default_factory=list)
    labs: list[LabSummaryOut] = Field(default_factory=list)
    challenges: list[ChallengeSummaryOut] = Field(default_factory=list)
    related_risks: list[RelatedRiskOut] = Field(default_factory=list)
