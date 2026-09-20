"""Agent Skills SKILL.md parser. Manifests are interpreted; scripts are never run."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from app.core.exceptions import ValidationError

_NAME_OK = set("abcdefghijklmnopqrstuvwxyz0123456789-")


@dataclass(frozen=True)
class BundledFile:
    path: Path
    relative: str
    size: int
    sha256: str
    disposition: str = "inspected_only"

    @property
    def name(self) -> str:
        return self.path.name


@dataclass
class LoadedSkill:
    id: str
    name: str
    description: str
    instructions: str
    allowed_tools: tuple[str, ...]
    license: str | None = None
    compatibility: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)
    content_hash: str = ""
    bundled_files: tuple[BundledFile, ...] = ()
    root: Path | None = None
    unsafe_yaml_refused: bool = False


def valid_skill_name(name: str) -> bool:
    if not name or len(name) > 64:
        return False
    if name[0] == "-" or name[-1] == "-":
        return False
    if "--" in name:
        return False
    return all(ch in _NAME_OK for ch in name)


def _parse_allowed_tools(raw: Any) -> tuple[str, ...]:
    if raw is None or raw == "":
        return ()
    if isinstance(raw, str):
        return tuple(part for part in raw.split() if part)
    if isinstance(raw, (list, tuple)):
        return tuple(str(item) for item in raw if str(item).strip())
    raise ValidationError("allowed-tools must be a space-separated string")


def _split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        raise ValidationError("SKILL.md must start with YAML frontmatter")
    rest = text[3:]
    if rest.startswith("\n"):
        rest = rest[1:]
    marker = "\n---"
    idx = rest.find(marker)
    if idx < 0:
        raise ValidationError("SKILL.md frontmatter is not closed")
    return rest[:idx], rest[idx + len(marker) :].lstrip("\n")


def _hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _bundled_files(root: Path) -> tuple[BundledFile, ...]:
    root_resolved = root.resolve()
    found: list[BundledFile] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        resolved = path.resolve()
        if resolved == root_resolved / "SKILL.md":
            continue
        if root_resolved not in resolved.parents and resolved.parent != root_resolved:
            continue
        data = resolved.read_bytes()
        relative = str(resolved.relative_to(root_resolved))
        found.append(
            BundledFile(
                path=resolved,
                relative=relative,
                size=len(data),
                sha256=_hash_bytes(data),
            )
        )
    return tuple(found)


def parse_skill_markdown(text: str, *, directory_name: str | None = None) -> LoadedSkill:
    raw_meta, body = _split_frontmatter(text)
    unsafe = False
    try:
        meta = yaml.safe_load(raw_meta) or {}
    except yaml.YAMLError:
        unsafe = True
        meta = {}
    if not isinstance(meta, dict):
        raise ValidationError("SKILL.md frontmatter must be a mapping")
    name = str(meta.get("name") or "").strip()
    description = str(meta.get("description") or "").strip()
    if not valid_skill_name(name):
        raise ValidationError(f"invalid skill name {name!r}")
    if directory_name is not None and name != directory_name:
        raise ValidationError(f"skill name {name!r} must match directory {directory_name!r}")
    if len(description) > 1024:
        raise ValidationError("skill description must be <= 1024 characters")
    extra = meta.get("metadata") or {}
    if extra and not all(isinstance(k, str) and isinstance(v, str) for k, v in extra.items()):
        extra = {str(k): str(v) for k, v in dict(extra).items()}
    return LoadedSkill(
        id=name,
        name=name,
        description=description,
        instructions=body,
        allowed_tools=_parse_allowed_tools(meta.get("allowed-tools")),
        license=(str(meta["license"]) if meta.get("license") else None),
        compatibility=(str(meta["compatibility"]) if meta.get("compatibility") else None),
        metadata=dict(extra),
        content_hash=_hash_bytes(text.encode("utf-8")),
        unsafe_yaml_refused=unsafe,
    )


def load_skill_dir(path: Path, *, require_name_match: bool = True) -> LoadedSkill:
    root = path.resolve()
    skill_md = root / "SKILL.md"
    if not skill_md.is_file():
        raise ValidationError(f"no SKILL.md in {root}")
    directory_name = root.name if require_name_match else None
    loaded = parse_skill_markdown(
        skill_md.read_text(encoding="utf-8"),
        directory_name=directory_name,
    )
    loaded.bundled_files = _bundled_files(root)
    loaded.root = root
    return loaded
