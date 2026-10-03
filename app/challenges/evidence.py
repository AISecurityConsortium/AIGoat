"""Plain evidence values for evaluators. CC BY-NC-SA: no Apache imports."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvidenceEvent:
    seq: int
    kind: str
    server_id: str = ""
    tool: str = ""
    args: dict[str, Any] = field(default_factory=dict)
    ok: bool | None = None
    decision: str = ""
    shown: dict[str, Any] = field(default_factory=dict)
    claimed_name: str = ""
    data: dict[str, Any] = field(default_factory=dict)
    parent_seq: int | None = None
