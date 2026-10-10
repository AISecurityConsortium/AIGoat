from __future__ import annotations

from app.defense.control import ControlAction, ControlOutcome, DefenseControl, DefenseDecision, DefenseStage
from app.defense.intent_classifier import IntentClassifier
from app.defense.policy_engine import PolicyEngine

_classifier = IntentClassifier()
_policy = PolicyEngine()


class IntentClassifyControl(DefenseControl):
    id = "intent.classify"
    name = "Intent classifier"
    verifies = (
        "the cleaned message is labelled by the pattern classifier and blocked "
        "when confidence exceeds the level's policy threshold"
    )
    applies_to = (DefenseStage.INPUT,)

    async def _evaluate(self, decision: DefenseDecision) -> ControlOutcome:
        intent = _classifier.classify(decision.payload)
        policy = _policy.evaluate(intent, decision.level)
        metadata = {
            "intent": intent.label,
            "confidence": intent.confidence,
            "intent_result": intent,
        }
        if not policy.allowed:
            return ControlOutcome(
                action=ControlAction.DENY,
                payload=decision.payload,
                control_id=self.id,
                reason=policy.reason,
                rejection_key=policy.rejection_key,
                metadata=metadata,
            )
        return ControlOutcome(
            action=ControlAction.ALLOW,
            payload=decision.payload,
            control_id=self.id,
            metadata=metadata,
        )
