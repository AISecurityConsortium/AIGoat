"""Per-user lab halt. In memory: a halt lasts until reset or process restart.

The flag blocks new runs. Cancelling in-flight runs is done by the callers,
which know about agent rows and host runs.
"""
from __future__ import annotations

_halted: set[tuple[int, str]] = set()


def is_halted(user_id: int, lab_id: str) -> bool:
    return (user_id, lab_id) in _halted


def halt_lab(user_id: int, lab_id: str) -> None:
    _halted.add((user_id, lab_id))


def clear_halt(user_id: int, lab_id: str) -> None:
    _halted.discard((user_id, lab_id))


def clear_all_halts() -> None:
    """Tests only."""
    _halted.clear()
