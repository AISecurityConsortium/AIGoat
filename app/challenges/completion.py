"""Compile a lab ``completion`` block and score an attempt's evidence."""
from __future__ import annotations

import json
import re
from typing import Any

from app.challenges.evidence import EvidenceEvent
from app.challenges.predicates import All, Event, Match, Seq, Submit


def _event(spec: dict[str, Any]) -> Event:
    ok = spec.get("ok")
    if ok is True:
        ok_flag: bool | None = True
    elif ok is False:
        ok_flag = False
    else:
        ok_flag = None
    return Event(
        kind=str(spec.get("event") or ""),
        server=spec.get("server"),
        tool=spec.get("tool"),
        decision=spec.get("decision"),
        ok=ok_flag,
        args=spec.get("args") if isinstance(spec.get("args"), dict) else None,
        shown_contains=spec.get("shown_contains") if isinstance(spec.get("shown_contains"), dict) else None,
    )


def _predicate(spec: dict[str, Any]) -> Any:
    if "all" in spec:
        return All([_predicate(child) for child in spec["all"]])
    if "seq" in spec:
        return Seq([_predicate(child) for child in spec["seq"]])
    if "submit" in spec:
        return Submit(spec["submit"] if isinstance(spec["submit"], dict) else {})
    return _event(spec)


def evaluate(lab: Any, events: list[EvidenceEvent], refs: dict[str, Any] | None = None) -> dict[str, Any]:
    """Score one attempt. ``refs`` holds server facts the YAML may point at."""
    completion = getattr(lab, "completion", None) or {}
    stages_spec = completion.get("stages") or []
    known = dict(refs or {})
    stage_rows: list[dict[str, Any]] = []
    reason = ""
    for spec in stages_spec:
        after_name = spec.get("after")
        after_seq = 0
        if after_name:
            prior = next((row for row in stage_rows if row["id"] == after_name and row["met"]), None)
            if prior is None:
                stage_rows.append({"id": spec.get("id"), "label": spec.get("label") or "", "met": False})
                reason = reason or "stage_incomplete"
                continue
            after_seq = int(prior.get("seq") or 0)
        if "causal" in spec:
            block = spec["causal"] if isinstance(spec["causal"], dict) else {}
            cause_id = str(block.get("cause") or "")
            cause = next((row for row in stage_rows if row["id"] == cause_id and row["met"]), None)
            if cause is None:
                stage_rows.append({"id": spec.get("id"), "label": spec.get("label") or "", "met": False})
                reason = reason or "stage_incomplete"
                continue
            effect = _event(block.get("effect") or {}).eval(events, int(cause.get("seq") or 0))
            if effect.ok and effect.event is not None:
                known[f"{spec.get('id')}.server_id"] = effect.event.server_id
                known[f"{spec.get('id')}.tool"] = effect.event.tool
            stage_rows.append({
                "id": spec.get("id"),
                "label": spec.get("label") or "",
                "met": effect.ok,
                "seq": max(effect.seqs) if effect.seqs else 0,
            })
            if not effect.ok:
                reason = reason or effect.reason or "stage_incomplete"
            continue
        predicate = _predicate(spec)
        if isinstance(predicate, Submit):
            match: Match = predicate.eval(events, after_seq, known)
        else:
            match = predicate.eval(events, after_seq)
        if match.ok and match.event is not None:
            known[f"{spec.get('id')}.server_id"] = match.event.server_id
            shown = spec.get("shown_contains") if isinstance(spec.get("shown_contains"), dict) else {}
            known[f"{spec.get('id')}.tool"] = shown.get("tool") or match.event.tool
            if shown.get("field"):
                known[f"{spec.get('id')}.field"] = shown.get("field")
            if shown.get("capture") == "token":
                found = re.search(r"aigoat-decoy-[A-Za-z0-9-]+", json.dumps(match.event.shown, default=str))
                known[f"{spec.get('id')}.token"] = found.group(0) if found else ""
        stage_rows.append({
            "id": spec.get("id"),
            "label": spec.get("label") or "",
            "met": match.ok,
            "seq": max(match.seqs) if match.seqs else 0,
        })
        if not match.ok:
            reason = reason or match.reason or "stage_incomplete"
    met = bool(stage_rows) and all(row["met"] for row in stage_rows)
    public = [{"id": row["id"], "label": row["label"], "met": row["met"]} for row in stage_rows]
    return {
        "exploit_triggered": met,
        "evaluator": "completion",
        "flag": None,
        "stages": public,
        "reason_code": "" if met else reason,
    }
