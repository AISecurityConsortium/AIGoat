"""Registry of TargetSurface instances, keyed by stable id."""
from __future__ import annotations

from app.surfaces.base import TargetSurface

_REGISTRY: dict[str, TargetSurface] = {}


def register_surface(surface: TargetSurface) -> None:
    if surface.id in _REGISTRY:
        raise ValueError(f"duplicate surface id {surface.id!r}")
    _REGISTRY[surface.id] = surface


def get_surface(surface_id: str) -> TargetSurface:
    try:
        return _REGISTRY[surface_id]
    except KeyError as exc:
        raise KeyError(f"unknown surface id {surface_id!r}") from exc


def all_surfaces() -> tuple[TargetSurface, ...]:
    return tuple(_REGISTRY.values())


def reset_surfaces() -> None:
    """Clear the registry. Tests only."""
    _REGISTRY.clear()
