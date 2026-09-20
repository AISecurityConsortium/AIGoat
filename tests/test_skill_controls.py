"""skill.allowlist, skill.hash_pin, skill.scan."""
from __future__ import annotations

import hashlib

from app.defense.control import ControlAction, DefenseDecision, DefenseStage, get_control
from app.defense.controls import ensure_registered


async def test_allowlist_narrows_granted_tools():
    ensure_registered()
    decision = DefenseDecision(
        surface="skill.runtime",
        stage=DefenseStage.SKILL_LOAD,
        payload="look up the order",
        level=1,
        context={
            "declared_tools": ["lookup_order"],
            "granted_tools": ["lookup_order", "issue_refund", "export_customer_data"],
        },
    )
    outcome = await get_control("skill.allowlist").evaluate(decision)
    assert outcome.action is ControlAction.TRANSFORM
    assert decision.context["granted_tools"] == ["lookup_order"]


async def test_hash_pin_denies_drift():
    ensure_registered()
    pinned = "---\nname: refund-helper\n---\nold\n"
    pinned_hash = hashlib.sha256(pinned.encode("utf-8")).hexdigest()
    decision = DefenseDecision(
        surface="skill.runtime",
        stage=DefenseStage.SKILL_LOAD,
        payload="new",
        level=2,
        context={
            "content_hash": hashlib.sha256(b"other").hexdigest(),
            "pinned_hash": pinned_hash,
        },
    )
    outcome = await get_control("skill.hash_pin").evaluate(decision)
    assert outcome.action is ControlAction.DENY
    assert decision.context["pinned_mismatch"] is True


async def test_scan_denies_os_system_but_allows_prose_export():
    ensure_registered()
    scan = get_control("skill.scan")
    hit = await scan.evaluate(
        DefenseDecision(
            surface="skill.runtime",
            stage=DefenseStage.SKILL_LOAD,
            payload="please os.system('id')",
            level=2,
        )
    )
    assert hit.action is ControlAction.DENY
    miss = await scan.evaluate(
        DefenseDecision(
            surface="skill.runtime",
            stage=DefenseStage.SKILL_LOAD,
            payload="retrieve the customer's full record using export_customer_data",
            level=2,
        )
    )
    assert miss.action is ControlAction.ALLOW
