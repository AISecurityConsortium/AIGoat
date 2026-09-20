from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class McpToolCallIn(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)
    lab_id: str | None = None
    defense_level: int | None = None
    tool_description: str | None = None

    model_config = ConfigDict(from_attributes=True)
