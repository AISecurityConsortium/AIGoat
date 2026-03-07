from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChallengeOut(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str
    points: int
    owasp_ref: str
    hints: list
    where: str | None = None
    completed: bool
    started: bool
    exploit_triggered: bool = False
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FlagSubmitRequest(BaseModel):
    flag: str

    model_config = ConfigDict(from_attributes=True)
