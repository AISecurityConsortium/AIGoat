"""Golden-transcript replay for the defense pipeline (T002).

Records the DECISION SURFACE, not rendered replies: validator verdict, classifier
label and confidence, policy decision, and moderator transformations. A reply diff
at level 2 would be worthless, because the NeMo rail calls an LLM and fails open
when the package is absent -- a CI recording would faithfully capture "L2 did
nothing" and keep passing after the integration was deleted.

This is the safety net for the planned defense controls refactor (decision D1).
If it fails, the refactor changed observable behaviour. Read the diff before
regenerating: regenerating to make a failure go away destroys the only evidence
that the refactor was behaviour-preserving.

Regenerate deliberately with:  python -m scripts.record_defense_golden
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.config import get_settings
from app.defense.intent_classifier import CONFIDENCE_FULL_MATCH_COUNT
from app.defense.output_moderator import OutputModerator
from app.defense.pipeline import defense_pipeline
from scripts.record_defense_golden import expand

_GOLDEN_DIR = Path(__file__).parent / "golden"
_BASELINE = json.loads((_GOLDEN_DIR / "defense_baseline.json").read_text())
_PAYLOADS = json.loads((_GOLDEN_DIR / "defense_payloads.json").read_text())

_INPUT_TEXT = {p["id"]: expand(p["text"]) for p in _PAYLOADS["input"]}
_OUTPUT_TEXT = {p["id"]: expand(p["text"]) for p in _PAYLOADS["output"]}

_REGEN_HINT = "If this change is intended, run: python -m scripts.record_defense_golden"


def test_thresholds_match_the_recorded_baseline():
    """A config change silently invalidates every row below, so fail loudly here."""
    settings = get_settings()
    recorded = _BASELINE["thresholds"]
    assert settings.defense.l1_confidence_threshold == recorded["l1_confidence_threshold"]
    assert settings.defense.l2_confidence_threshold == recorded["l2_confidence_threshold"]
    assert CONFIDENCE_FULL_MATCH_COUNT == recorded["confidence_full_match_count"]


def test_baseline_covers_every_payload_at_every_level():
    expected = len(_PAYLOADS["input"]) * 3
    assert len(_BASELINE["input"]) == expected, (
        f"baseline has {len(_BASELINE['input'])} input rows, expected {expected}. {_REGEN_HINT}"
    )
    assert len(_BASELINE["input"]) >= 120, "corpus too small to be a meaningful safety net"


@pytest.mark.parametrize(
    "row",
    _BASELINE["input"],
    ids=lambda r: f"{r['payload_id']}-L{r['level']}",
)
async def test_input_decision_matches_golden(row):
    text = _INPUT_TEXT[row["payload_id"]]
    result = await defense_pipeline.process_input(text, row["level"], user_id=None)
    where = f"{row['payload_id']} at L{row['level']}"

    assert result.allowed == row["allowed"], f"allowed changed for {where}. {_REGEN_HINT}"
    assert result.message == row["message"], f"message changed for {where}. {_REGEN_HINT}"
    assert result.blocked_reason == row["blocked_reason"], (
        f"blocked_reason changed for {where}. {_REGEN_HINT}"
    )

    label = result.intent.label if result.intent else None
    confidence = round(result.intent.confidence, 4) if result.intent else None
    assert label == row["intent"], f"intent label changed for {where}. {_REGEN_HINT}"
    assert confidence == row["confidence"], f"confidence changed for {where}. {_REGEN_HINT}"


@pytest.mark.parametrize(
    "row",
    _BASELINE["input"],
    ids=lambda r: f"{r['payload_id']}-L{r['level']}-chain",
)
async def test_input_decision_matches_golden_via_chain(row):
    """T062: the control chain agrees with the recorded decision surface."""
    from app.defense.chain import run_chain
    from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
    from app.defense.controls import ensure_registered
    from app.defense.profiles import resolve_profile
    from app.defense.rejection import get_rejection_response

    ensure_registered()
    text = _INPUT_TEXT[row["payload_id"]]
    level = row["level"]
    where = f"{row['payload_id']} at L{row['level']} (chain)"

    if level == 0:
        allowed, message, label, confidence, blocked_reason = True, text, None, None, None
    else:
        profile = resolve_profile("chat.cracky", level)
        input_ids = tuple(
            cid for cid in profile.controls
            if DefenseStage.INPUT in get_control(cid).applies_to
        )
        chain = await run_chain(
            input_ids,
            DefenseDecision(
                surface="chat.cracky",
                stage=DefenseStage.INPUT,
                payload=text,
                level=level,
            ),
        )
        intent_result = None
        for outcome in reversed(chain.outcomes):
            if outcome.metadata.get("intent_result") is not None:
                intent_result = outcome.metadata["intent_result"]
                break
        if chain.final.action in (ControlAction.DENY, ControlAction.REQUIRE_APPROVAL):
            allowed = False
            message = get_rejection_response(chain.final.rejection_key or "default")
            blocked_reason = chain.final.reason
        else:
            allowed = True
            message = chain.final.payload
            blocked_reason = None
        label = intent_result.label if intent_result else None
        confidence = round(intent_result.confidence, 4) if intent_result else None

    assert allowed == row["allowed"], f"allowed changed for {where}. {_REGEN_HINT}"
    assert message == row["message"], f"message changed for {where}. {_REGEN_HINT}"
    assert blocked_reason == row["blocked_reason"], f"blocked_reason changed for {where}. {_REGEN_HINT}"
    assert label == row["intent"], f"intent label changed for {where}. {_REGEN_HINT}"
    assert confidence == row["confidence"], f"confidence changed for {where}. {_REGEN_HINT}"


@pytest.mark.parametrize(
    "row",
    _BASELINE["output"],
    ids=lambda r: f"{r['text_id']}-L{r['level']}",
)
def test_output_moderation_matches_golden(row):
    text = _OUTPUT_TEXT[row["text_id"]]
    moderated = OutputModerator().moderate(text, row["level"])
    where = f"{row['text_id']} at L{row['level']}"
    assert moderated == row["moderated"], f"moderation changed for {where}. {_REGEN_HINT}"
    assert len(moderated) == row["length"], f"moderated length changed for {where}. {_REGEN_HINT}"


class TestBaselineEncodesExpectedBehaviour:
    """Sanity checks on what was recorded, so an obviously wrong baseline is caught.

    These assert properties of the baseline file itself rather than re-running the
    pipeline, so they fail fast if someone regenerates against broken code.
    """

    def _row(self, payload_id: str, level: int) -> dict:
        return next(
            r for r in _BASELINE["input"]
            if r["payload_id"] == payload_id and r["level"] == level
        )

    def test_level_zero_allows_everything(self):
        blocked = [r["payload_id"] for r in _BASELINE["input"] if r["level"] == 0 and not r["allowed"]]
        assert not blocked, (
            f"Level 0 blocked {blocked}. Level 0 is the platform's core intentional "
            f"vulnerability and must pass everything through."
        )

    def test_benign_traffic_is_allowed_at_every_level(self):
        refused = [
            f"{r['payload_id']}-L{r['level']}"
            for r in _BASELINE["input"]
            if r["payload_id"].startswith("benign-") and not r["allowed"]
        ]
        assert not refused, f"benign shop traffic refused: {refused}"

    def test_a_multi_signal_attack_is_blocked_at_level_1(self):
        assert self._row("jailbreak-01", 1)["allowed"] is False, (
            "an unambiguous jailbreak must be blocked at L1; the classifier fix (T005) "
            "may have regressed"
        )

    def test_single_signal_attacks_are_blocked_at_level_2(self):
        assert self._row("resource-01", 2)["allowed"] is False
        assert self._row("extraction-01", 2)["allowed"] is False

    def test_oversized_input_is_rejected_when_defended(self):
        assert self._row("edge-len-2500", 1)["allowed"] is False
        assert self._row("edge-len-2500", 0)["allowed"] is True


@pytest.mark.parametrize(
    "row",
    _BASELINE["output"],
    ids=lambda r: f"{r['text_id']}-L{r['level']}-pipeline",
)
async def test_output_moderation_matches_golden_via_pipeline(row):
    text = _OUTPUT_TEXT[row["text_id"]]
    moderated = await defense_pipeline.moderate_output(text, row["level"])
    where = f"{row['text_id']} at L{row['level']} (pipeline)"
    assert moderated == row["moderated"], f"moderation changed for {where}. {_REGEN_HINT}"


async def test_level_zero_does_not_resolve_profile(monkeypatch):
    called = {"n": 0}

    def boom(*_args, **_kwargs):
        called["n"] += 1
        raise AssertionError("resolve_profile must not run at level 0")

    monkeypatch.setattr("app.defense.pipeline.resolve_profile", boom)
    result = await defense_pipeline.process_input("hello from L0", 0, user_id=None)
    assert result.allowed is True
    assert result.message == "hello from L0"
    assert called["n"] == 0


async def test_resolve_profile_error_is_not_swallowed(monkeypatch):
    def boom(*_args, **_kwargs):
        raise ValueError("unknown defense surface 'nope' (level 1)")

    monkeypatch.setattr("app.defense.pipeline.resolve_profile", boom)
    with pytest.raises(ValueError, match="unknown defense surface"):
        await defense_pipeline.process_input("hello", 1, user_id=None)
