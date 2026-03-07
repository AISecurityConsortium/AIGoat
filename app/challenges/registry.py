"""Challenge evaluator registry.

Maps evaluator keys (canonical, lowercase) to their evaluator instances.
Lookup uses the challenge's ``evaluator_key`` column which is set in
the seed data from ``CHALLENGE_DEFINITIONS``.
"""
from __future__ import annotations

from app.challenges.evaluator import ChallengeEvaluator
from app.challenges.evaluators.chained_exploit import ChainedExploitEvaluator
from app.challenges.evaluators.context_override import ContextOverrideEvaluator
from app.challenges.evaluators.context_poisoning import ContextPoisoningEvaluator
from app.challenges.evaluators.multistep_injection import MultiStepInjectionEvaluator
from app.challenges.evaluators.prompt_injection import PromptInjectionEvaluator
from app.challenges.evaluators.rag_manipulation import RAGManipulationEvaluator
from app.challenges.evaluators.role_confusion import RoleConfusionEvaluator
from app.challenges.evaluators.state_exploitation import StateExploitationEvaluator
from app.challenges.evaluators.system_prompt_extraction import SystemPromptExtractionEvaluator

_REGISTRY: dict[str, ChallengeEvaluator] = {
    "prompt injection": PromptInjectionEvaluator(),
    "system prompt extraction": SystemPromptExtractionEvaluator(),
    "rag manipulation": RAGManipulationEvaluator(),
    "context override": ContextOverrideEvaluator(),
    "multi-step injection": MultiStepInjectionEvaluator(),
    "role confusion": RoleConfusionEvaluator(),
    "context poisoning": ContextPoisoningEvaluator(),
    "chained exploit": ChainedExploitEvaluator(),
    "state exploitation": StateExploitationEvaluator(),
}


def get_evaluator_by_title(key: str) -> ChallengeEvaluator | None:
    """Look up evaluator by key (case-insensitive)."""
    return _REGISTRY.get(key.strip().lower())
