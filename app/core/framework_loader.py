"""Framework manifest loader.

Reads taxonomy files from ``config/frameworks/*.yml`` into frozen dataclasses.
Used by the taxonomy API and the in-memory cross-mapping index.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

_ALLOWED_STATUS = {"stable", "draft", "release_candidate", "beta"}
_REQUIRED_FRAMEWORK_FIELDS = (
    "id",
    "name",
    "version",
    "status",
    "publisher",
    "url",
    "source_license",
    "attribution",
    "prose_origin",
)
_REQUIRED_RISK_FIELDS = ("code", "title", "summary", "description")

_frameworks: tuple[Framework, ...] | None = None
_frameworks_by_id: dict[str, Framework] | None = None
_risks_by_id: dict[str, Risk] | None = None


@dataclass(frozen=True)
class Risk:
    framework_id: str
    code: str
    title: str
    summary: str
    description: str
    attack_surfaces: tuple[str, ...] = ()
    related: tuple[str, ...] = ()

    @property
    def id(self) -> str:
        return f"{self.framework_id}:{self.code}"


@dataclass(frozen=True)
class Framework:
    id: str
    name: str
    version: str
    status: str
    publisher: str
    url: str
    source_license: str
    attribution: str
    prose_origin: str
    published: str | None = None
    supersedes: str | None = None
    maturity_note: str | None = None
    risks: tuple[Risk, ...] = ()


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _resolve_frameworks_dir() -> Path:
    env_path = os.environ.get("FRAMEWORKS_CONFIG_PATH")
    if env_path:
        return Path(env_path)
    from app.core.config import get_settings

    configured = get_settings().taxonomy.frameworks_path
    path = Path(configured)
    if not path.is_absolute():
        path = _project_root() / path
    return path


def _is_framework_file(path: Path) -> bool:
    if path.suffix != ".yml":
        return False
    if path.name == "LICENSE" or path.name.startswith("_"):
        return False
    return True


def _require_non_empty(data: dict[str, Any], field: str, path: Path) -> str:
    value = data.get(field)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"{path}: missing required field {field!r}")
    return str(value).strip() if isinstance(value, str) else value


def _optional_str(data: dict[str, Any], field: str) -> str | None:
    value = data.get(field)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_risk(raw: Any, framework_id: str, path: Path, seen_codes: set[str]) -> Risk:
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: each risk must be a mapping")
    for field in _REQUIRED_RISK_FIELDS:
        if not str(raw.get(field) or "").strip():
            raise ValueError(f"{path}: risk missing required field {field!r}")
    code = str(raw["code"]).strip()
    if code in seen_codes:
        raise ValueError(f"{path}: duplicate risk code {code!r}")
    seen_codes.add(code)
    surfaces = tuple(raw.get("attack_surfaces") or ())
    related = tuple(raw.get("related") or ())
    return Risk(
        framework_id=framework_id,
        code=code,
        title=str(raw["title"]).strip(),
        summary=str(raw["summary"]).strip(),
        description=str(raw["description"]).strip(),
        attack_surfaces=tuple(str(s) for s in surfaces),
        related=tuple(str(r) for r in related),
    )


def _parse_framework(path: Path) -> Framework:
    try:
        with path.open() as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        raise ValueError(f"{path}: malformed YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected a mapping at the top level")

    for field in _REQUIRED_FRAMEWORK_FIELDS:
        _require_non_empty(data, field, path)

    framework_id = str(data["id"]).strip()
    if framework_id != path.stem:
        raise ValueError(f"{path}: id {framework_id!r} does not match filename stem {path.stem!r}")

    status = str(data["status"]).strip()
    if status not in _ALLOWED_STATUS:
        raise ValueError(f"{path}: status {status!r} is not one of {sorted(_ALLOWED_STATUS)}")

    risks_raw = data.get("risks")
    if not isinstance(risks_raw, list):
        raise ValueError(f"{path}: risks must be a list")

    seen_codes: set[str] = set()
    risks = tuple(_parse_risk(item, framework_id, path, seen_codes) for item in risks_raw)

    attribution = data["attribution"]
    if not isinstance(attribution, str):
        attribution = str(attribution)
    attribution = attribution.strip()

    return Framework(
        id=framework_id,
        name=str(data["name"]).strip(),
        version=str(data["version"]).strip(),
        status=status,
        publisher=str(data["publisher"]).strip(),
        url=str(data["url"]).strip(),
        source_license=str(data["source_license"]).strip(),
        attribution=attribution,
        prose_origin=str(data["prose_origin"]).strip(),
        published=_optional_str(data, "published"),
        supersedes=_optional_str(data, "supersedes"),
        maturity_note=_optional_str(data, "maturity_note"),
        risks=risks,
    )


def load_framework_manifest() -> tuple[Framework, ...]:
    global _frameworks, _frameworks_by_id, _risks_by_id
    if _frameworks is not None:
        return _frameworks

    directory = _resolve_frameworks_dir()
    if not directory.exists():
        raise ValueError(f"frameworks directory not found: {directory}")

    files = sorted(p for p in directory.iterdir() if p.is_file() and _is_framework_file(p))
    frameworks: list[Framework] = []
    for path in files:
        frameworks.append(_parse_framework(path))

    by_id = {fw.id: fw for fw in frameworks}
    risks_by_id: dict[str, Risk] = {}
    for fw in frameworks:
        for risk in fw.risks:
            risks_by_id[risk.id] = risk

    _frameworks = tuple(frameworks)
    _frameworks_by_id = by_id
    _risks_by_id = risks_by_id
    logger.info("Loaded %s framework(s) with %s risk(s) from %s", len(frameworks), len(risks_by_id), directory)
    return _frameworks


def reset_framework_cache() -> None:
    global _frameworks, _frameworks_by_id, _risks_by_id
    _frameworks = None
    _frameworks_by_id = None
    _risks_by_id = None


def get_all_frameworks() -> tuple[Framework, ...]:
    return load_framework_manifest()


def get_framework_by_id(framework_id: str) -> Framework | None:
    load_framework_manifest()
    assert _frameworks_by_id is not None
    return _frameworks_by_id.get(framework_id)


def get_all_risks() -> tuple[Risk, ...]:
    load_framework_manifest()
    assert _risks_by_id is not None
    return tuple(_risks_by_id.values())


def get_risk_by_id(qualified_id: str) -> Risk | None:
    load_framework_manifest()
    assert _risks_by_id is not None
    return _risks_by_id.get(qualified_id)


def get_framework_dict(framework_id: str) -> dict[str, Any] | None:
    fw = get_framework_by_id(framework_id)
    if fw is None:
        return None
    return {
        "id": fw.id,
        "name": fw.name,
        "version": fw.version,
        "status": fw.status,
        "publisher": fw.publisher,
        "url": fw.url,
        "source_license": fw.source_license,
        "attribution": fw.attribution,
        "prose_origin": fw.prose_origin,
        "published": fw.published,
        "supersedes": fw.supersedes,
        "maturity_note": fw.maturity_note,
        "risks": [
            {
                "id": risk.id,
                "framework_id": risk.framework_id,
                "code": risk.code,
                "title": risk.title,
                "summary": risk.summary,
                "description": risk.description,
                "attack_surfaces": list(risk.attack_surfaces),
                "related": list(risk.related),
            }
            for risk in fw.risks
        ],
    }
