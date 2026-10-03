"""Small predicate set. Milestone 1 needs Event, All, and Submit.

Seq is included because ordered stages are the next real lab, not a
theoretical extra. Do not add predicates until a migrated lab needs them.
"""
from __future__ import annotations

import json
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
    def __init__(self, fields: dict[str, Any]) -> None:
        self.fields = fields

    def eval(self, events: list[EvidenceEvent], after_seq: int = 0, refs: dict[str, Any] | None = None) -> Match:
        refs = refs or {}
        submission = None
        seq = 0
        for event in events:
            if event.kind != "submission" or event.seq <= after_seq:
                continue
            submission = event.data.get("fields") if isinstance(event.data, dict) else None
            seq = event.seq
        if not isinstance(submission, dict):
            return Match(False, reason="submission_missing")
        for name, rule in self.fields.items():
            got = _norm(submission.get(name))
            if not got:
                return Match(False, reason="submission_mismatch")
            if not isinstance(rule, dict):
                return Match(False, reason="submission_mismatch")
            if "equals_ref" in rule:
                expected = _norm(refs.get(str(rule["equals_ref"])))
                if not expected or got != expected:
                    return Match(False, reason="submission_mismatch")
            elif "any_of_ref" in rule:
                options = []
                for ref in rule["any_of_ref"]:
                    value = refs.get(str(ref))
                    if isinstance(value, list):
                        options.extend(_norm(item) for item in value)
                    else:
                        options.append(_norm(value))
                if got not in {item for item in options if item}:
                    return Match(False, reason="submission_mismatch")
            else:
                return Match(False, reason="submission_mismatch")
        return Match(True, [seq])
