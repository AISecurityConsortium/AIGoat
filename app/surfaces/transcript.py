"""Normalized transcript events for every TargetSurface.

Evaluators read the pre-defense payload from ``raw``. ``content`` (and
``transformed``) is what the model / UI saw after controls. Mixing those up
awards flags on every L1 truncated reply (see ``02-architecture.md`` §2.3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

EVENT_TYPES = frozenset({
    "user_message",
    "model_output",
    "retrieval",
    "tool_call",
    "tool_result",
    "mcp_request",
    "mcp_response",
    "approval_request",
    "control_decision",
    "memory_read",
    "memory_write",
})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Event:
    """One transcript step.

    ``kind`` is the API ``type``. Extra per-type fields live in ``data``.
    ``raw`` is the pre-defense value; ``transformed`` is the post-control value
    when they differ.
    """

    kind: str
    data: dict[str, Any] = field(default_factory=dict)
    seq: int = 0
    ts: str = ""
    raw: Any = None
    transformed: Any = None

    def to_api(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "seq": self.seq,
            "type": self.kind,
            "ts": self.ts,
            **self.data,
        }
        if self.raw is not None:
            payload["raw"] = self.raw
        if self.transformed is not None:
            payload["transformed"] = self.transformed
        return payload


class Transcript:
    def __init__(self) -> None:
        self._events: list[Event] = []

    def add(
        self,
        kind: str,
        *,
        raw: Any = None,
        transformed: Any = None,
        **data: Any,
    ) -> Event:
        if kind not in EVENT_TYPES:
            raise ValueError(f"unknown transcript event type {kind!r}")
        event = Event(
            kind=kind,
            data=data,
            seq=len(self._events),
            ts=_now(),
            raw=raw,
            transformed=transformed,
        )
        self._events.append(event)
        return event

    @property
    def events(self) -> tuple[Event, ...]:
        return tuple(self._events)

    def to_api(self) -> list[dict[str, Any]]:
        return [event.to_api() for event in self._events]


def validate_event(payload: dict[str, Any]) -> None:
    """Raise ValueError if an API-shaped event is malformed."""
    kind = payload.get("type")
    if kind not in EVENT_TYPES:
        raise ValueError(f"unknown transcript event type {kind!r}")
    if "seq" not in payload:
        raise ValueError("transcript event missing seq")
    if "ts" not in payload:
        raise ValueError("transcript event missing ts")
    if kind in {"user_message", "model_output"} and "content" not in payload:
        raise ValueError(f"{kind} event missing content")
    if kind in {"user_message", "model_output"} and "raw" not in payload:
        raise ValueError(
            f"{kind} event missing raw (evaluators must observe the pre-defense payload)"
        )
