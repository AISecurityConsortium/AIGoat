"""Load skills from the controlled packs directory. Never executes bundled files."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.skills.parser import LoadedSkill, load_skill_dir


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def packs_root() -> Path:
    configured = get_settings().skills.packs_path
    path = Path(configured)
    if not path.is_absolute():
        path = _project_root() / path
    return path.resolve()


def list_pack_dirs() -> tuple[Path, ...]:
    root = packs_root()
    if not root.is_dir():
        return ()
    return tuple(sorted(p for p in root.iterdir() if p.is_dir() and (p / "SKILL.md").is_file()))


@lru_cache
def load_all_skills() -> tuple[LoadedSkill, ...]:
    loaded: list[LoadedSkill] = []
    for path in list_pack_dirs():
        loaded.append(load_skill_dir(path))
    return tuple(loaded)


def reset_skill_cache() -> None:
    load_all_skills.cache_clear()


def get_skill(skill_id: str) -> LoadedSkill:
    for skill in load_all_skills():
        if skill.id == skill_id:
            return skill
    raise NotFoundError(f"Skill {skill_id} not found")


def load_skill_path(path: Path) -> LoadedSkill:
    """Load one directory that contains SKILL.md. Used by tests and the runtime."""
    resolved = path.resolve()
    if not resolved.is_dir():
        raise ValidationError(f"skill path {path} is not a directory")
    return load_skill_dir(resolved, require_name_match=False)
