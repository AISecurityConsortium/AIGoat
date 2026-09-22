"""Defense profiles: (surface, level) -> ordered control ids + intent prose.

Control-id validation is deferred until the first ``resolve_profile`` /
``load_defense_profiles`` call, which imports ``app.defense.controls`` so the
registry is populated. Validating at import would see an empty registry
(T062 registers the concrete controls).
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_SURFACES = (
    "chat.cracky",
    "rag.kb",
    "agent.runner",
    "mcp.client",
    "api.raw",
)
_LEVELS = (0, 1, 2)

_profiles: dict[tuple[str, int], DefenseProfile] | None = None
_source_path: Path | None = None


@dataclass(frozen=True)
class DefenseProfile:
    surface: str
    level: int
    intent: str
    controls: tuple[str, ...] = ()


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _profiles_path() -> Path:
    env_path = os.environ.get("DEFENSE_PROFILES_PATH")
    if env_path:
        return Path(env_path)
    from app.core.config import get_settings

    configured = get_settings().defense.profiles_path
    path = Path(configured)
    if not path.is_absolute():
        path = _project_root() / path
    return path


def _as_level(key: Any) -> int:
    try:
        return int(key)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"profile level key {key!r} is not an integer") from exc


def _ensure_controls_registered() -> None:
    from app.defense.controls import ensure_registered

    ensure_registered()


def _validate_profile(surface: str, level: int, raw: Any, path: Path) -> DefenseProfile:
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: {surface} level {level} must be a mapping")
    intent = str(raw.get("intent") or "").strip()
    if not intent:
        raise ValueError(f"{path}: {surface} level {level} is missing a non-empty intent")
    controls_raw = raw.get("controls") or []
    if not isinstance(controls_raw, list):
        raise ValueError(f"{path}: {surface} level {level} controls must be a list")
    controls: list[str] = []
    seen: set[str] = set()
    for cid in controls_raw:
        cid_s = str(cid).strip()
        if not cid_s:
            raise ValueError(f"{path}: {surface} level {level} has an empty control id")
        if cid_s in seen:
            raise ValueError(f"{path}: {surface} level {level} duplicates control id {cid_s!r}")
        seen.add(cid_s)
        from app.defense.control import get_control

        try:
            get_control(cid_s)
        except KeyError as exc:
            raise ValueError(
                f"{path}: {surface} level {level} references unregistered control id {cid_s!r}"
            ) from exc
        controls.append(cid_s)
    if level == 0 and controls:
        raise ValueError(
            f"{path}: {surface} level 0 must have an empty controls list (intentional vulnerability)"
        )
    return DefenseProfile(surface=surface, level=level, intent=intent, controls=tuple(controls))


def load_defense_profiles() -> dict[tuple[str, int], DefenseProfile]:
    global _profiles, _source_path
    if _profiles is not None:
        return _profiles
    _ensure_controls_registered()
    path = _profiles_path()
    if not path.is_file():
        raise ValueError(f"defense profiles file not found: {path}")
    with path.open() as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict) or not isinstance(data.get("profiles"), dict):
        raise ValueError(f"{path}: top-level 'profiles' mapping is required")
    raw_profiles = data["profiles"]
    loaded: dict[tuple[str, int], DefenseProfile] = {}
    for surface, levels in raw_profiles.items():
        surface_s = str(surface).strip()
        if surface_s not in _SURFACES:
            raise ValueError(f"{path}: unknown surface {surface_s!r}")
        if not isinstance(levels, dict):
            raise ValueError(f"{path}: {surface_s} must map levels 0/1/2")
        present = {_as_level(k) for k in levels}
        if present != set(_LEVELS):
            raise ValueError(
                f"{path}: {surface_s} must declare exactly levels 0, 1 and 2 (got {sorted(present)})"
            )
        for key, body in levels.items():
            level = _as_level(key)
            loaded[(surface_s, level)] = _validate_profile(surface_s, level, body, path)
    missing = [s for s in _SURFACES if not any(s == surf for (surf, _) in loaded)]
    if missing:
        raise ValueError(f"{path}: missing surfaces {missing}")
    _profiles = loaded
    _source_path = path
    logger.info("Loaded %s defense profiles from %s", len(loaded), path)
    return _profiles


def reset_profiles_cache() -> None:
    global _profiles, _source_path
    _profiles = None
    _source_path = None


def resolve_profile(surface: str, level: int) -> DefenseProfile:
    load_defense_profiles()
    assert _profiles is not None
    if surface not in _SURFACES:
        raise ValueError(f"unknown defense surface {surface!r} (level {level})")
    if level not in _LEVELS:
        raise ValueError(f"unknown defense level {level} for surface {surface!r}")
    try:
        return _profiles[(surface, level)]
    except KeyError as exc:
        raise ValueError(f"unknown defense surface {surface!r} (level {level})") from exc


def all_surfaces() -> tuple[str, ...]:
    load_defense_profiles()
    return _SURFACES
