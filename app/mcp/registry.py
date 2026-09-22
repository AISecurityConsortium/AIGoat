"""Allow-listed MCP server registry. argv never comes from a request."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, ValidationError

ALLOWED_ERAS = frozenset({"2026-stateless", "2025-session"})
ALLOWED_TIERS = frozenset({"official", "community", "untrusted"})


@dataclass(frozen=True)
class McpServerSpec:
    id: str
    name: str
    module: str
    trust_tier: str
    protocol_era: str
    script_path: Path

    def command_display(self) -> list[str]:
        return [sys.executable, str(self.script_path)]

    def command_display_redacted(self) -> list[str]:
        """Learner-facing argv: literal interpreter name and project-relative script."""
        rel = self.script_path.resolve().relative_to(_project_root()).as_posix()
        return ["python", rel]


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _servers_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "mcp_servers"


def _registry_path() -> Path:
    configured = get_settings().mcp.registry_path
    path = Path(configured)
    if not path.is_absolute():
        path = _project_root() / path
    return path


def _resolve_module(module: str) -> Path:
    name = Path(module).name
    if name != module or not name.endswith(".py") or name.startswith("."):
        raise ValidationError(f"illegal MCP server module {module!r}")
    root = _servers_dir().resolve()
    path = (root / name).resolve()
    if root not in path.parents and path != root:
        raise ValidationError(f"MCP server module {module!r} is outside the server directory")
    if not path.is_file():
        raise ValidationError(f"MCP server module {module!r} is not a file")
    return path


@lru_cache
def load_mcp_registry() -> tuple[McpServerSpec, ...]:
    path = _registry_path()
    if not path.is_file():
        raise ValidationError(f"MCP registry not found at {path}")
    with path.open() as handle:
        raw = yaml.safe_load(handle) or {}
    rows = raw.get("servers") or []
    specs: list[McpServerSpec] = []
    seen: set[str] = set()
    for row in rows:
        server_id = str(row.get("id") or "").strip()
        if not server_id:
            raise ValidationError("MCP registry entry missing id")
        if server_id in seen:
            raise ValidationError(f"duplicate MCP server id {server_id!r}")
        era = str(row.get("protocol_era") or "2026-stateless")
        if era not in ALLOWED_ERAS:
            raise ValidationError(f"MCP server {server_id}: unknown protocol_era {era!r}")
        tier = str(row.get("trust_tier") or "community")
        if tier not in ALLOWED_TIERS:
            raise ValidationError(f"MCP server {server_id}: unknown trust_tier {tier!r}")
        module = str(row.get("module") or "")
        specs.append(
            McpServerSpec(
                id=server_id,
                name=str(row.get("name") or server_id),
                module=module,
                trust_tier=tier,
                protocol_era=era,
                script_path=_resolve_module(module),
            )
        )
        seen.add(server_id)
    return tuple(specs)


def reset_mcp_registry() -> None:
    load_mcp_registry.cache_clear()


def list_server_specs() -> tuple[McpServerSpec, ...]:
    return load_mcp_registry()


def get_server_spec(server_id: str) -> McpServerSpec:
    for spec in load_mcp_registry():
        if spec.id == server_id:
            return spec
    raise NotFoundError(f"MCP server {server_id} not found")


def servers_public() -> list[dict[str, object]]:
    return [
        {
            "id": spec.id,
            "name": spec.name,
            "transport": "stdio",
            "trust_tier": spec.trust_tier,
            "protocol_era": spec.protocol_era,
            "command_display": spec.command_display(),
            "command_display_redacted": spec.command_display_redacted(),
        }
        for spec in load_mcp_registry()
    ]
