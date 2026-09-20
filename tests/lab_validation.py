"""Harness for asserting that labs are still exploitable.

AIGoat's vulnerabilities are its product. A refactor that silently stops a lab
being exploitable leaves CI green and the platform broken, which is the worst
possible failure mode for a training tool. These helpers make that detectable.

Read the failure messages before "fixing" anything they report: a failure here
usually means a lab regressed, not that the assertion is wrong.
"""
from __future__ import annotations

from app.challenges.evaluator import EvalContext, KBEntry
from app.challenges.registry import get_evaluator_by_title


def build_ctx(
    user_message: str = "",
    model_output: str = "",
    chat_history: list[dict[str, str]] | None = None,
    kb_entries: list[KBEntry] | None = None,
    defense_level: int = 0,
) -> EvalContext:
    """Construct an EvalContext without touching HTTP, a database, or an LLM."""
    return EvalContext(
        user_message=user_message,
        model_output=model_output,
        chat_history=chat_history or [],
        kb_entries_used=kb_entries or [],
        defense_level=defense_level,
    )


def get_evaluator(evaluator_key: str):
    evaluator = get_evaluator_by_title(evaluator_key)
    assert evaluator is not None, (
        f"evaluator {evaluator_key!r} is not registered in app/challenges/registry.py"
    )
    return evaluator


def assert_lab_vulnerable(evaluator_key: str, ctx: EvalContext, why: str = "") -> None:
    """The exploit must be detected. Failure means a lab stopped working."""
    evaluator = get_evaluator(evaluator_key)
    assert evaluator.check_exploit(ctx) is True, (
        f"LAB REGRESSION: evaluator {evaluator_key!r} no longer fires on a payload that "
        f"should succeed. {why} "
        f"This usually means the lab prompt, the evaluator markers, or the defense "
        f"pipeline changed. Do not weaken the assertion to make it pass."
    )


def assert_lab_not_triggered(evaluator_key: str, ctx: EvalContext, why: str = "") -> None:
    """A false positive would award a flag for nothing."""
    evaluator = get_evaluator(evaluator_key)
    assert evaluator.check_exploit(ctx) is False, (
        f"FALSE POSITIVE: evaluator {evaluator_key!r} fired on output that does not "
        f"represent a successful exploit. {why}"
    )
