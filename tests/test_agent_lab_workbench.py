"""Agentic lab workbench: lab content shape, hints and progress, completion, takeaway gating."""
from __future__ import annotations

import re
from pathlib import Path

from httpx import AsyncClient

from app.core.lab_loader import get_all_labs
from tests.conftest import auth_header
from tests.fake_llm import FakeLLMClient
from tests.test_agentic_lab_walk import _coupon, _customer, _run

ROOT = Path(__file__).resolve().parent.parent
TEACHING = ROOT / "frontend" / "src" / "utils" / "labTeaching.js"
TAKEAWAY_KEYS = {"learned", "why", "defense", "secure"}


def _agent_track() -> list:
    """Every lab on the Agentic hub: all agent.runner labs plus the asi host labs."""
    return [
        lab for lab in get_all_labs()
        if lab.surface == "agent.runner" or (lab.surface == "mcp.host" and lab.id.startswith("asi"))
    ]


def _nav_ids() -> list[str]:
    text = TEACHING.read_text(encoding="utf-8")
    block = text[text.index("export const AGENT_NAV_GROUPS"):text.index("export const AGENT_ORDER")]
    ids: list[str] = []
    for group in re.findall(r"labs: \[([^\]]*)\]", block):
        ids.extend(re.findall(r"'([^']+)'", group))
    return ids


def test_every_agent_lab_has_workbench_content():
    labs = _agent_track()
    assert len(labs) >= 12
    for lab in labs:
        ui = lab.ui or {}
        assert lab.briefing.strip(), lab.id
        assert len(lab.hints) == 5, lab.id
        for key in ("goal", "summary", "done_when"):
            assert str(ui.get(key) or "").strip(), (lab.id, key)
        assert len(ui.get("steps") or []) >= 3, lab.id
        assert len(ui.get("evidence") or []) >= 2, lab.id
        assert set(lab.takeaway) == TAKEAWAY_KEYS, lab.id
        # No hint ladder tier may be blank, and the first tier is a nudge, not a payload.
        assert all(hint.strip() for hint in lab.hints), lab.id
        assert not lab.hints[0].lower().startswith("send:"), lab.id


def test_admin_labs_declare_the_admin_login():
    labs = {lab.id: lab for lab in _agent_track()}
    for lab_id in ("asi03-1", "asi05-1", "asi07-1", "asi08-1", "asi04-1"):
        assert labs[lab_id].ui.get("sign_in") == "admin", lab_id


def test_memory_and_halt_controls_only_where_the_lab_uses_them():
    labs = {lab.id: lab for lab in _agent_track()}
    memory = {lab_id for lab_id, lab in labs.items() if lab.ui.get("memory")}
    assert memory == {"asi06-1", "asi06-2", "asi10-1"}
    halt = {lab_id for lab_id, lab in labs.items() if lab.ui.get("halt")}
    assert halt == {"asi10-1"}
    for lab_id in memory:
        assert "remember" in labs[lab_id].surface_config.get("allowed_tools", []) or lab_id == "asi10-1"


def test_lab_switcher_groups_cover_every_agent_lab_once():
    ids = _nav_ids()
    expected = {lab.id for lab in _agent_track()} | {"killchain-1"}
    assert len(ids) == len(set(ids))
    assert set(ids) == expected


async def test_hints_and_progress_work_without_a_guided_completion(client: AsyncClient):
    token = await _customer(client, "wb_hints")
    headers = auth_header(token)
    start = await client.get("/api/labs/asi02-1/progress", headers=headers)
    assert start.status_code == 200, start.text
    body = start.json()
    assert body["hints"] == []
    assert body["hint_total"] == 5
    assert body["completed"] is False

    first = await client.post("/api/labs/asi02-1/hints/next", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["revealed"] == 1
    assert len(first.json()["hints"]) == 1
    again = await client.get("/api/labs/asi02-1/progress", headers=headers)
    assert len(again.json()["hints"]) == 1

    # Submit and solution stay guided-only.
    solution = await client.post("/api/labs/asi02-1/solution", headers=headers)
    assert solution.status_code == 404


async def test_completion_is_recorded_and_the_takeaway_waits_for_it(
    client: AsyncClient, fake_llm: FakeLLMClient,
):
    token = await _customer(client, "wb_done")
    headers = auth_header(token)
    before = (await client.get("/api/labs/asi02-1", headers=headers)).json()
    assert before["completed_at"] is None
    assert before["takeaway"] == {}
    assert before["ui"]["goal"]

    _coupon(fake_llm)
    body = await _run(client, token, "asi02-1", "Apply coupon STAFF100 to order 1003.", 0)
    assert body["evaluation"]["exploit_triggered"] is True

    after = (await client.get("/api/labs/asi02-1", headers=headers)).json()
    assert after["completed_at"]
    assert set(after["takeaway"]) == TAKEAWAY_KEYS
    progress = (await client.get("/api/labs/asi02-1/progress", headers=headers)).json()
    assert progress["completed"] is True

    reset = await client.post("/api/labs/asi02-1/reset", headers=headers)
    assert reset.status_code == 200
    cleared = (await client.get("/api/labs/asi02-1", headers=headers)).json()
    assert cleared["completed_at"] is None
    assert cleared["takeaway"] == {}


async def test_a_run_that_does_not_score_does_not_complete_the_lab(
    client: AsyncClient, fake_llm: FakeLLMClient,
):
    token = await _customer(client, "wb_nodone")
    fake_llm.script_turns([{"content": "I can only help with the shop."}])
    body = await _run(client, token, "asi02-1", "Tell me about your shop.", 0)
    assert body["evaluation"]["exploit_triggered"] is False
    detail = (await client.get("/api/labs/asi02-1", headers=auth_header(token))).json()
    assert detail["completed_at"] is None
