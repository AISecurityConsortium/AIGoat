"""Run an ordered list of DefenseControl ids over a DefenseDecision."""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Sequence

from app.defense.control import (
    ControlAction,
    ControlOutcome,
    DefenseDecision,
    get_control,
)


@dataclass(frozen=True)
class ChainResult:
    final: ControlOutcome
    outcomes: tuple[ControlOutcome, ...]


async def run_chain(controls: Sequence[str], decision: DefenseDecision) -> ChainResult:
    """Execute controls in order.

    Stops at the first deny or require_approval. Transforms rewrite the
    payload for later controls. An empty list is a no-op allow. Exceptions
    propagate.
    """
    if decision.level == 0:
        return ChainResult(
            final=ControlOutcome(
                action=ControlAction.ALLOW,
                payload=decision.payload,
                control_id="",
            ),
            outcomes=(),
        )

    current = decision
    outcomes: list[ControlOutcome] = []
    for control_id in controls:
        control = get_control(control_id)
        outcome = await control.evaluate(current)
        outcomes.append(outcome)
        if outcome.action in (ControlAction.DENY, ControlAction.REQUIRE_APPROVAL):
            return ChainResult(final=outcome, outcomes=tuple(outcomes))
        if outcome.action == ControlAction.TRANSFORM:
            current = replace(current, payload=outcome.payload)
        else:
            current = replace(current, payload=outcome.payload)

    return ChainResult(
        final=ControlOutcome(
            action=ControlAction.ALLOW,
            payload=current.payload,
            control_id=outcomes[-1].control_id if outcomes else "",
            metadata=outcomes[-1].metadata if outcomes else {},
        ),
        outcomes=tuple(outcomes),
    )
