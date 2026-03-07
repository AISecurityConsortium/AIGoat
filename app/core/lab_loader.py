"""Lab manifest loader.

Reads lab definitions from ``config/labs.yml`` and provides typed
access. Used by the labs API and the chat system to resolve lab
metadata, prompt files, and defense overrides.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class LabDefinition(BaseModel):
    id: str
    name: str
    owasp: str
    status: str = "active"
    defense_override: int | None = None
    prompt_file: str | None = None
    challenge_evaluator: str | None = None
    description: str = ""


class LabManifest(BaseModel):
    labs: list[LabDefinition]


def _resolve_path() -> Path:
    env_path = None
    import os
    env_path = os.environ.get("LABS_CONFIG_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent.parent.parent / "config" / "labs.yml"


@lru_cache
def load_lab_manifest() -> LabManifest:
    path = _resolve_path()
    if not path.exists():
        logger.warning("labs.yml not found at %s, using empty manifest", path)
        return LabManifest(labs=[])
    with open(path) as f:
        data = yaml.safe_load(f)
    return LabManifest(**data)


def get_all_labs() -> list[LabDefinition]:
    return load_lab_manifest().labs


def get_lab_by_id(lab_id: str) -> LabDefinition | None:
    for lab in get_all_labs():
        if lab.id == lab_id:
            return lab
    return None


def get_lab_dict(lab_id: str) -> dict[str, Any] | None:
    """Return lab definition as a dict (backward-compatible with existing code)."""
    lab = get_lab_by_id(lab_id)
    if lab is None:
        return None
    return lab.model_dump()
