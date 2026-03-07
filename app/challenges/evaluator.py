"""Abstract base for challenge exploit evaluators.

Each challenge implements a concrete evaluator whose ``check_exploit``
method inspects the user message and the model output (and optionally
chat history) and returns ``True`` when the exploit condition is met.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class KBEntry:
    """A single KB chunk with provenance metadata."""

    content: str
    is_user_injected: bool = False


@dataclass
class EvalContext:
    """Minimal context passed to every evaluator."""

    user_message: str
    model_output: str
    chat_history: list[dict[str, str]] = field(default_factory=list)
    kb_entries_used: list[KBEntry] = field(default_factory=list)
    defense_level: int = 0


class ChallengeEvaluator(ABC):
    """One instance per challenge type.  Stateless."""

    @abstractmethod
    def check_exploit(self, ctx: EvalContext) -> bool:
        """Return True when the exploit condition is confirmed."""
