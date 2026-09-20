"""Defense control interface (T060).

A level is no longer an integer applied to a string: each control declares
what it verifies, and a profile (T061) lists which controls run on a surface
at a given level. Pipeline adapters (T063) import this module; this module
must never import ``app.defense.pipeline``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class DefenseStage(str, Enum):
    INPUT = "input"
    OUTPUT = "output"
    TOOL_CALL = "tool_call"
    RETRIEVAL = "retrieval"
    SKILL_LOAD = "skill_load"


class ControlAction(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    TRANSFORM = "transform"
    REQUIRE_APPROVAL = "require_approval"


@dataclass(frozen=True)
class DefenseDecision:
    surface: str
    stage: DefenseStage
    payload: str
    level: int
    context: dict[str, Any] = field(default_factory=dict)
    user_id: int | None = None


@dataclass(frozen=True)
class ControlOutcome:
    action: ControlAction
    payload: str
    control_id: str
    reason: str | None = None
    rejection_key: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class DefenseControl(ABC):
    id: str
    name: str
    verifies: str
    applies_to: tuple[DefenseStage, ...] = ()

    async def evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        """Default: stages this control does not apply to are a no-op allow.

        Subclasses implement ``_evaluate``. Exceptions propagate — a control
        must not swallow errors into ``allow``.
        """
        if decision.stage not in self.applies_to:
            return ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id=self.id,
            )
        return await self._evaluate(decision)

    @abstractmethod
    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome: ...


_REGISTRY: dict[str, DefenseControl] = {}


def register_control(control: DefenseControl) -> None:
    if control.id in _REGISTRY:
        raise ValueError(f"duplicate control id {control.id!r}")
    _REGISTRY[control.id] = control


def get_control(control_id: str) -> DefenseControl:
    try:
        return _REGISTRY[control_id]
    except KeyError as exc:
        raise KeyError(f"unknown control id {control_id!r}") from exc


def all_controls() -> tuple[DefenseControl, ...]:
    return tuple(_REGISTRY.values())


def reset_controls() -> None:
    """Clear the registry. Tests only."""
    _REGISTRY.clear()
