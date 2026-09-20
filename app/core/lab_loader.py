"""Lab manifest loader.

Reads lab definitions from ``config/labs/*.yml`` (with ``config/labs.yml`` as
a fallback) and provides typed access. Used by the labs API and the chat
system to resolve lab metadata, prompt files, and defense overrides.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

ALLOWED_SURFACES = frozenset(
    {
        "chat.cracky",
        "rag.kb",
        "agent.runner",
        "mcp.client",
        "skill.runtime",
        "api.raw",
    }
)


class LabDefinition(BaseModel):
    id: str
    name: str
    owasp: str = ""
    status: str = "active"
    defense_override: int | None = None
    prompt_file: str | None = None
    challenge_evaluator: str | None = None
    description: str = ""
    risks: tuple[str, ...] = ()
    surface: str = "chat.cracky"
    surface_config: dict[str, Any] = Field(default_factory=dict)
    difficulty: str = "beginner"
    objective: str = ""
    prerequisites: tuple[str, ...] = ()
    attack_steps: tuple[str, ...] = ()
    example_payloads: tuple[str, ...] = ()
    expected_by_level: dict[int, str] = Field(default_factory=dict)
    remediation: str = ""
    references: tuple[str, ...] = ()
    challenge_id: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data = dict(data)
        owasp = data.get("owasp") or ""
        risks = tuple(data.get("risks") or ())
        if not risks and owasp:
            data["risks"] = [f"owasp-llm-2025:{owasp}"]
        elif risks and not owasp:
            first = risks[0]
            data["owasp"] = first.split(":", 1)[-1] if ":" in str(first) else first

        surface_config = dict(data.get("surface_config") or {})
        top_override = data.get("defense_override")
        nested_override = surface_config.get("defense_override")
        if top_override is not None:
            surface_config["defense_override"] = top_override
        elif nested_override is not None:
            data["defense_override"] = nested_override
        data["surface_config"] = surface_config

        surface = data.get("surface") or "chat.cracky"
        data["surface"] = surface
        if surface not in ALLOWED_SURFACES:
            raise ValueError(f"lab {data.get('id')}: invalid surface {surface!r}")

        expected = data.get("expected_by_level") or {}
        if expected:
            data["expected_by_level"] = {int(k): str(v) for k, v in expected.items()}
        return data


class LabManifest(BaseModel):
    labs: list[LabDefinition]


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _fallback_labs_file() -> Path:
    return _project_root() / "config" / "labs.yml"


def _configured_labs_dir() -> Path:
    from app.core.config import get_settings

    configured = get_settings().taxonomy.labs_path
    path = Path(configured)
    if not path.is_absolute():
        path = _project_root() / path
    return path


def _is_lab_file(path: Path) -> bool:
    if path.suffix != ".yml":
        return False
    if path.name == "LICENSE" or path.name.startswith("_"):
        return False
    return True


def _labs_from_file(path: Path) -> list[LabDefinition]:
    if not path.exists():
        logger.warning("labs file not found at %s, using empty manifest", path)
        return []
    with path.open() as f:
        raw = yaml.safe_load(f)
    if not raw:
        return []
    manifest = LabManifest(**raw)
    return list(manifest.labs)


def _load_from_directory(labs_dir: Path) -> LabManifest:
    dir_files = sorted(p for p in labs_dir.iterdir() if p.is_file() and _is_lab_file(p))
    if not dir_files:
        return LabManifest(labs=_labs_from_file(_fallback_labs_file()))

    by_id: dict[str, LabDefinition] = {}
    origin: dict[str, Path] = {}

    fallback = _fallback_labs_file()
    if fallback.exists():
        for lab in _labs_from_file(fallback):
            by_id[lab.id] = lab
            origin[lab.id] = fallback

    for path in dir_files:
        for lab in _labs_from_file(path):
            previous = origin.get(lab.id)
            if previous is not None and previous.parent == labs_dir:
                raise ValueError(f"duplicate lab id {lab.id!r} in {previous} and {path}")
            if previous is not None:
                logger.warning("lab id %s in %s overridden by %s", lab.id, previous, path)
            by_id[lab.id] = lab
            origin[lab.id] = path

    return LabManifest(labs=list(by_id.values()))


@lru_cache
def load_lab_manifest() -> LabManifest:
    env_path = os.environ.get("LABS_CONFIG_PATH")
    if env_path:
        return LabManifest(labs=_labs_from_file(Path(env_path)))

    labs_dir = _configured_labs_dir()
    if labs_dir.is_dir():
        return _load_from_directory(labs_dir)

    fallback = _fallback_labs_file()
    if fallback.exists():
        return LabManifest(labs=_labs_from_file(fallback))
    logger.warning("labs.yml not found at %s, using empty manifest", fallback)
    return LabManifest(labs=[])


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
