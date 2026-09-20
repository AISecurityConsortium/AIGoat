from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AgentRunIn(BaseModel):
    lab_id: str
    goal: str
    session_token: str | None = None
    defense_level: Literal[0, 1, 2] | None = None

    model_config = ConfigDict(from_attributes=True)


class AgentApproveIn(BaseModel):
    step_seq: int
    decision: Literal["approve", "deny"]

    model_config = ConfigDict(from_attributes=True)


class AgentRunOut(BaseModel):
    run_id: str
    status: str
    lab_id: str
    goal: str
    defense_level: int
    max_steps: int
    answer: str = ""
    terminated_reason: str = ""
    steps: list[dict[str, Any]] = Field(default_factory=list)
    pending: dict[str, Any] | None = None
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    defense: dict[str, Any] = Field(default_factory=dict)
    evaluation: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)
