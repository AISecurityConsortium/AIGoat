from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class SkillInstallIn(BaseModel):
    lab_id: str | None = None
    defense_level: Literal[0, 1, 2] | None = None
    fetch_docs: bool = False

    model_config = ConfigDict(from_attributes=True)
