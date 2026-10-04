"""Submit rules: evidence picks a recorded event, any_of holds per-level alternatives."""
from __future__ import annotations

from app.challenges.evidence import EvidenceEvent
from app.challenges.predicates import Submit

RESULT = EvidenceEvent(
    seq=2, kind="tool_result", server_id="s", tool="notes",
    args={"ticket_id": "T-1"}, ok=True, shown={"text": ["key sk-shop-billing-abc123"]},
)
REDACTED = EvidenceEvent(
    seq=3, kind="tool_result", server_id="s", tool="notes",
    args={"ticket_id": "T-1"}, ok=True, shown={"text": ["key [redacted]"]},
)

RULES = {
    "any_of": [
        {
            "evidence": {"evidence": {
                "event": {"event": "tool_result", "tool": "notes", "shown_contains": {"marker": "sk-shop-billing-"}},
                "capture": {"pattern": "sk-shop-billing-[a-f0-9]+", "as": "token"},
            }},
            "value": {"equals_ref": "evidence.token"},
        },
        {
            "evidence": {"evidence": {"event": {"event": "tool_result", "shown_contains": {"marker": "[redacted]"}}}},
            "value": {"equals": "[redacted]"},
        },
    ],
}


def _submission(seq: int, **fields) -> EvidenceEvent:
    return EvidenceEvent(seq=seq, kind="submission", data={"fields": fields})


def test_evidence_capture_feeds_the_value_check():
    events = [RESULT, _submission(9, evidence="2", value="sk-shop-billing-abc123")]
    assert Submit(RULES).eval(events).ok is True


def test_wrong_value_reports_the_field():
    events = [RESULT, _submission(9, evidence="2", value="sk-shop-billing-000")]
    match = Submit(RULES).eval(events)
    assert match.ok is False
    assert match.reason == "submission_mismatch:value"


def test_second_alternative_accepts_redacted_evidence():
    events = [REDACTED, _submission(9, evidence="3", value="[redacted]")]
    assert Submit(RULES).eval(events).ok is True


def test_evidence_must_exist_precede_and_match():
    assert Submit(RULES).eval([RESULT, _submission(9, evidence="7", value="x")]).reason == "evidence_mismatch"
    late = EvidenceEvent(seq=12, kind="tool_result", tool="notes", shown={"text": ["sk-shop-billing-abc123"]})
    assert Submit(RULES).eval([late, _submission(9, evidence="12", value="sk-shop-billing-abc123")]).ok is False
    assert Submit(RULES).eval([RESULT, _submission(9, evidence="abc", value="x")]).ok is False


def test_missing_submission():
    assert Submit(RULES).eval([RESULT]).reason == "submission_missing"


def test_plain_rules_still_work():
    rules = {"finding": {"equals": "yes"}}
    assert Submit(rules).eval([_submission(1, finding="yes")]).ok is True
    assert Submit(rules).eval([_submission(1, finding="no")]).reason == "submission_mismatch:finding"


AUTO = {
    "evidence": {"evidence": {
        "auto": True,
        "event": {"event": "tool_result", "tool": "notes", "shown_contains": {"marker": "sk-shop-billing-"}},
        "capture": {"pattern": "sk-shop-billing-[a-f0-9]+", "as": "token"},
    }},
    "value": {"equals_ref": "evidence.token"},
}


def test_auto_evidence_attaches_the_latest_matching_prior_event():
    other = EvidenceEvent(seq=1, kind="tool_result", server_id="s", tool="notes", ok=True, shown={"text": ["none"]})
    assert Submit(AUTO).eval([other, RESULT, _submission(9, value="sk-shop-billing-abc123")]).ok is True
    assert Submit(AUTO).eval([other, RESULT, _submission(9, value="sk-shop-billing-ffff")]).ok is False


def test_auto_evidence_ignores_learner_supplied_seq_and_later_events():
    assert Submit(AUTO).eval([other_kind(1), _submission(9, evidence="1", value="sk-shop-billing-abc123")]).ok is False
    late = EvidenceEvent(
        seq=12, kind="tool_result", server_id="s", tool="notes", ok=True, shown={"text": ["sk-shop-billing-abc123"]},
    )
    assert Submit(AUTO).eval([_submission(9, value="sk-shop-billing-abc123"), late]).ok is False


def other_kind(seq: int) -> EvidenceEvent:
    return EvidenceEvent(seq=seq, kind="discover", server_id="s", shown={"text": ["sk-shop-billing-abc123"]})
