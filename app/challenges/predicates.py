"""Small predicate set. Milestone 1 needs Event, All, and Submit.

Seq is included because ordered stages are the next real lab, not a
theoretical extra. Do not add predicates until a migrated lab needs them.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.challenges.evidence import EvidenceEvent


@dataclass
class Match:
    ok: bool
    seqs: list[int] = field(default_factory=list)
    reason: str = ""
    event: EvidenceEvent | None = None


def _norm(value: Any) -> str:
    return " ".join(str(value or "").casefold().split())


class Event:
    @classmethod
    def from_spec(cls, spec: dict[str, Any]) -> Event:
        ok = spec.get("ok")
        return cls(
            kind=str(spec.get("event") or ""),
            server=spec.get("server"),
            tool=spec.get("tool"),
            decision=spec.get("decision"),
            ok=True if ok is True else (False if ok is False else None),
            args=spec.get("args") if isinstance(spec.get("args"), dict) else None,
            shown_contains=spec.get("shown_contains") if isinstance(spec.get("shown_contains"), dict) else None,
        )

    def __init__(
        self,
        kind: str,
        server: str | None = None,
        tool: str | None = None,
        decision: str | None = None,
        ok: bool | None = None,
        args: dict[str, Any] | None = None,
        shown_contains: dict[str, Any] | None = None,
    ) -> None:
        self.kind = kind
        self.server = server
        self.tool = tool
        self.decision = decision
        self.ok = ok
        self.args = args or {}
        self.shown_contains = shown_contains or {}

    def eval(self, events: list[EvidenceEvent], after_seq: int = 0) -> Match:
        reason = "stage_incomplete"
        for event in events:
            if event.seq <= after_seq or event.kind != self.kind:
                continue
            if self.tool and event.tool != self.tool:
                continue
            if self.server and event.server_id != self.server:
                if self.tool and event.tool == self.tool:
                    reason = "wrong_server"
                continue
            if self.decision and event.decision != self.decision:
                continue
            if self.ok is True and event.ok is not True:
                reason = "call_failed"
                continue
            if not self._args_ok(event):
                reason = "empty_args"
                continue
            if not self._shown_ok(event):
                continue
            return Match(True, [event.seq], event=event)
        return Match(False, reason=reason)

    def _args_ok(self, event: EvidenceEvent) -> bool:
        for key, rule in self.args.items():
            value = event.args.get(key)
            if rule == "non_empty" and not str(value or "").strip():
                return False
            if rule != "non_empty" and value != rule and str(value).casefold() != str(rule).casefold():
                return False
        return True

    def _shown_ok(self, event: EvidenceEvent) -> bool:
        if not self.shown_contains:
            return True
        tool = self.shown_contains.get("tool")
        marker = str(self.shown_contains.get("marker") or "")
        for row in (event.shown or {}).get("tools") or []:
            if not isinstance(row, dict):
                continue
            if tool and row.get("name") != tool:
                continue
            blob = json.dumps(row, default=str)
            if marker and marker in blob:
                return True
        structured = (event.shown or {}).get("structured")
        if isinstance(structured, dict) and marker and marker in json.dumps(structured, default=str):
            if self._marker_is_echo(event, marker):
                return False
            return True
        text = (event.shown or {}).get("text")
        if marker and marker in json.dumps(text, default=str):
            if self._marker_is_echo(event, marker):
                return False
            return True
        return False

    def _marker_is_echo(self, event: EvidenceEvent, marker: str) -> bool:
        return any(marker in str(value) for value in (event.args or {}).values())


class All:
    def __init__(self, children: list[Any]) -> None:
        self.children = children

    def eval(self, events: list[EvidenceEvent], after_seq: int = 0) -> Match:
        seqs: list[int] = []
        for child in self.children:
            match = child.eval(events, after_seq)
            if not match.ok:
                return Match(False, seqs, reason=match.reason)
            seqs.extend(match.seqs)
        return Match(True, seqs)


class Seq:
    """Children must match at strictly increasing sequence numbers."""

    def __init__(self, children: list[Any]) -> None:
        self.children = children

    def eval(self, events: list[EvidenceEvent], after_seq: int = 0) -> Match:
        seqs: list[int] = []
        cursor = after_seq
        for child in self.children:
            match = child.eval(events, cursor)
            if not match.ok:
                return Match(False, seqs, reason=match.reason)
            seqs.extend(match.seqs)
            cursor = max(match.seqs)
        return Match(True, seqs)


class Submit:
    """Score the latest submission after ``after_seq``.

    ``any_of`` lists alternative field sets. An ``evidence`` rule names an event
    spec; the submitted value is a seq that must point at a matching event of
    this attempt, recorded before the submission. With ``auto: true`` nothing is
    submitted and the latest matching event is used. Evidence is checked first so
    a capture from that event can feed ``equals_ref: evidence.<name>``.
    """

    def __init__(self, fields: dict[str, Any]) -> None:
        self.fields = fields

    def eval(self, events: list[EvidenceEvent], after_seq: int = 0, refs: dict[str, Any] | None = None) -> Match:
        submission = None
        seq = 0
        for event in events:
            if event.kind != "submission" or event.seq <= after_seq:
                continue
            submission = event.data.get("fields") if isinstance(event.data, dict) else None
            seq = event.seq
        if not isinstance(submission, dict):
            return Match(False, reason="submission_missing")
        alternatives = self.fields.get("any_of")
        if not isinstance(alternatives, list):
            alternatives = [self.fields]
        best_passed = -1
        best_reason = "submission_mismatch"
        for alternative in alternatives:
            if not isinstance(alternative, dict):
                continue
            passed, reason = self._check(alternative, submission, events, seq, dict(refs or {}))
            if not reason:
                return Match(True, [seq])
            if passed > best_passed:
                best_passed, best_reason = passed, reason
        return Match(False, reason=best_reason)

    def _check(
        self,
        rules: dict[str, Any],
        submission: dict[str, Any],
        events: list[EvidenceEvent],
        submission_seq: int,
        refs: dict[str, Any],
    ) -> tuple[int, str]:
        ordered = sorted(rules.items(), key=lambda item: 0 if "evidence" in (item[1] or {}) else 1)
        passed = 0
        for name, rule in ordered:
            got = _norm(submission.get(name))
            if not isinstance(rule, dict):
                return passed, "submission_mismatch"
            if "evidence" in rule:
                if not self._evidence_ok(rule["evidence"], got, events, submission_seq, refs):
                    return passed, "evidence_mismatch"
                passed += 1
                continue
            if not got:
                return passed, f"submission_mismatch:{name}"
            if "equals_ref" in rule:
                expected = _norm(refs.get(str(rule["equals_ref"])))
                if not expected or got != expected:
                    return passed, f"submission_mismatch:{name}"
            elif "equals" in rule:
                if got != _norm(rule["equals"]):
                    return passed, f"submission_mismatch:{name}"
            elif "any_of_ref" in rule:
                options = []
                for ref in rule["any_of_ref"]:
                    value = refs.get(str(ref))
                    if isinstance(value, list):
                        options.extend(_norm(item) for item in value)
                    else:
                        options.append(_norm(value))
                if got not in {item for item in options if item}:
                    return passed, f"submission_mismatch:{name}"
            else:
                return passed, f"submission_mismatch:{name}"
            passed += 1
        return passed, ""

    def _evidence_ok(
        self,
        spec: Any,
        got: str,
        events: list[EvidenceEvent],
        submission_seq: int,
        refs: dict[str, Any],
    ) -> bool:
        if not isinstance(spec, dict):
            return False
        prior = [event for event in events if event.seq < submission_seq and event.kind != "submission"]
        matcher = Event.from_spec(spec.get("event") or {})
        if spec.get("auto"):
            picked = next((event for event in reversed(prior) if matcher.eval([event]).ok), None)
        elif got.isdigit():
            picked = next((event for event in prior if event.seq == int(got)), None)
            if picked is not None and not matcher.eval([picked]).ok:
                picked = None
        else:
            picked = None
        if picked is None:
            return False
        capture = spec.get("capture") if isinstance(spec.get("capture"), dict) else None
        if capture:
            found = re.search(str(capture.get("pattern") or ""), json.dumps(picked.shown, default=str))
            refs[f"evidence.{capture.get('as') or 'value'}"] = found.group(0) if found else ""
        return True
