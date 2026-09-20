from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str
    use_kb: bool = False
    challenge_id: int | None = None
    lab_id: str | None = None
    # Explicit per-request defense level. Set only when the learner has chosen a
    # level for this session; it outranks a lab's recommended starting level.
    # Transient by design -- never written back to User.defense_level.
    defense_level: Optional[Literal[0, 1, 2]] = None

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    reply: str
    kb_used: bool = False
    kb_context_count: int = 0
    citations: list[dict] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DefenseLevelOut(BaseModel):
    current_level: int
    levels: list[dict]

    model_config = ConfigDict(from_attributes=True)


class SetDefenseLevelRequest(BaseModel):
    level: int

    model_config = ConfigDict(from_attributes=True)
