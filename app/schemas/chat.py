from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    message: str
    use_kb: bool = False
    challenge_id: int | None = None
    lab_id: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    reply: str
    kb_used: bool = False
    kb_context_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class DefenseLevelOut(BaseModel):
    current_level: int
    levels: list[dict]

    model_config = ConfigDict(from_attributes=True)


class SetDefenseLevelRequest(BaseModel):
    level: int

    model_config = ConfigDict(from_attributes=True)
