"""Recorded incident logs for forensics labs. The answer key stays server-side."""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _root() -> Path:
    return Path(__file__).resolve().parents[2] / "config" / "labs" / "fixtures"


@lru_cache
def _load(name: str) -> dict[str, Any]:
    path = _root() / f"{name}.json"
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"fixture {name} is not an object")
    return data


def choose_fixture(user_id: int, lab_id: str, attempt: int, variants: list[str]) -> dict[str, Any]:
    if not variants:
        raise ValueError(f"{lab_id} has no fixture variants")
    digest = hashlib.sha256(f"{user_id}:{lab_id}:{attempt}".encode()).digest()
    name = variants[digest[0] % len(variants)]
    data = _load(name)
    return {"id": name, "events": list(data.get("events") or []), "answer": dict(data.get("answer") or {})}


def fixture_refs(chosen: dict[str, Any]) -> dict[str, Any]:
    answer = chosen.get("answer") or {}
    controls = answer.get("controls") or []
    return {
        "fixture.answer.server_id": answer.get("server_id") or "",
        "fixture.answer.tool": answer.get("tool") or "",
        "fixture.answer.seq": str(answer.get("seq") or ""),
        "fixture.answer.controls": list(controls),
    }
