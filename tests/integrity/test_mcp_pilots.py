"""Cold-path integrity for the learner-first MCP pilot labs.

Completion is a lab-specific submission: the learner states a security judgment
and the platform attaches the matching recorded event of the current attempt.
The learner never selects an event. Page load, discovery, tool lists, tool
calls, wrong conclusions, echoes, replays, and other users do not finish a lab.
Each defense level has its own evidence-backed conclusion.
"""
from __future__ import annotations

from httpx import AsyncClient

from app.mcp.env import reset_all_server_state
from tests.conftest import auth_header

TOKEN = "sk-shop-billing-7f3a9c2e1b84"
BILLING_TICKET = "TCK-1042"
CANARY = "MCP-POISON-CANARY-7F3A"
PILOTS = ("mcp01-1", "mcp02-1", "mcp03-1", "mcp09-1")


def setup_function():
    reset_all_server_state("community_support")


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _met(resp) -> bool:
    body = resp.json()
    evaluation = body.get("evaluation") or {}
    return bool(evaluation.get("exploit_triggered"))


def _reason(resp) -> str:
    return str((resp.json().get("evaluation") or {}).get("reason_code") or "")


async def _lab(client, headers, lab_id) -> dict:
    resp = await client.get(f"/api/labs/{lab_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _completed(client, headers, lab_id) -> bool:
    return bool((await _lab(client, headers, lab_id)).get("completed_at"))


async def _events(client, headers, lab_id) -> list[dict]:
    resp = await client.get(f"/api/labs/{lab_id}/progress", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["events"]


async def _get(client, headers, lab_id, server, kind, level=0):
    return await client.get(
        f"/api/mcp/servers/{server}/{kind}",
        headers=headers,
        params={"lab_id": lab_id, "defense_level": level},
    )


async def _call(client, headers, lab_id, server, tool, arguments, level=0):
    return await client.post(
        f"/api/mcp/servers/{server}/tools/{tool}/call",
        headers=headers,
        json={"arguments": arguments, "lab_id": lab_id, "defense_level": level},
    )


async def _submit(client, headers, lab_id, fields):
    return await client.post(
        f"/api/labs/{lab_id}/submit",
        headers=headers,
        json={"fields": fields},
    )


async def _open(client, headers, lab_id):
    started = await client.post(f"/api/labs/{lab_id}/start", headers=headers)
    assert started.status_code == 200, started.text
    assert await _completed(client, headers, lab_id) is False
    return started.json()


async def _notes(client, headers, ticket, level=0):
    return await _call(
        client, headers, "mcp01-1", "community_support", "read_internal_notes", {"ticket_id": ticket}, level,
    )


async def test_pilot_forms_never_ask_for_an_event(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot_forms"))
    expected = {
        "mcp01-1": ["value"],
        "mcp02-1": ["finding", "outcome"],
        "mcp03-1": ["finding"],
        "mcp09-1": ["integration", "reason"],
    }
    for lab_id, names in expected.items():
        submission = (await _lab(client, headers, lab_id))["ui"]["submission"]
        assert "evidence" not in submission, lab_id
        assert list(submission["fields"]) == names, lab_id
        assert submission["ready_after"], lab_id
        assert "seq" not in str(submission), lab_id


async def test_mcp01_positive_and_defense_levels(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot01"))
    await _open(client, headers, "mcp01-1")
    assert (await _lab(client, headers, "mcp01-1"))["takeaway"] == {}
    listed = await _get(client, headers, "mcp01-1", "community_support", "tools")
    tools = {row["name"]: row["description"] for row in listed.json()["result"]["tools"]}
    assert "list_tickets" in tools
    assert "IMPORTANT" not in tools["lookup_ticket"]
    assert _met(listed) is False
    queue = await _call(client, headers, "mcp01-1", "community_support", "list_tickets", {})
    subjects = str(queue.json()["result"])
    assert "Charged twice" in subjects
    assert "Billing API" not in subjects and "secret" not in subjects.lower()
    unknown = await _notes(client, headers, "TCK-9999")
    assert "not found" in str(unknown.json()["result"])
    assert TOKEN not in str(unknown.json()["result"])
    routine = await _notes(client, headers, "TCK-1008")
    assert TOKEN not in "\n".join(routine.json()["result"]["text"])
    assert _met(routine) is False

    no_credential_yet = await _submit(client, headers, "mcp01-1", {"value": TOKEN})
    assert _met(no_credential_yet) is False
    assert _reason(no_credential_yet) == "evidence_mismatch"
    assert "credential-like" in no_credential_yet.json()["guidance"]

    leaked = await _notes(client, headers, BILLING_TICKET)
    assert TOKEN in "\n".join(leaked.json()["result"]["text"])
    assert _met(leaked) is False
    assert await _completed(client, headers, "mcp01-1") is False

    wrong_value = await _submit(client, headers, "mcp01-1", {"value": "TCK-1042"})
    assert _met(wrong_value) is False
    assert "exactly" in wrong_value.json()["guidance"]
    assert TOKEN not in wrong_value.json()["guidance"]
    done = await _submit(client, headers, "mcp01-1", {"value": TOKEN})
    assert _met(done) is True
    assert done.json()["evaluation"]["flag"] is None
    assert done.json()["takeaway"]["learned"]
    assert await _completed(client, headers, "mcp01-1") is True
    assert (await _lab(client, headers, "mcp01-1"))["takeaway"]["secure"]

    level_one = auth_header(await _token(client, "pilot01_l1"))
    await _notes(client, level_one, BILLING_TICKET, 1)
    assert _met(await _submit(client, level_one, "mcp01-1", {"value": TOKEN})) is True

    level_two = auth_header(await _token(client, "pilot01_l2"))
    redacted = await _notes(client, level_two, BILLING_TICKET, 2)
    assert TOKEN not in "\n".join(redacted.json()["result"]["text"])
    assert "[redacted]" in "\n".join(redacted.json()["result"]["text"])
    assert _met(await _submit(client, level_two, "mcp01-1", {"value": TOKEN})) is False
    assert _met(await _submit(client, level_two, "mcp01-1", {"value": "[redacted]"})) is True


async def test_mcp01_negatives_replay_and_cross_user(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot01_neg"))
    await _open(client, headers, "mcp01-1")
    assert _met(await _get(client, headers, "mcp01-1", "community_support", "discover")) is False
    assert _met(await _get(client, headers, "mcp01-1", "community_support", "tools")) is False
    public = await _call(
        client, headers, "mcp01-1", "community_support", "lookup_ticket", {"ticket_id": BILLING_TICKET},
    )
    assert TOKEN not in str(public.json()["result"])
    assert _met(public) is False
    before = await _submit(client, headers, "mcp01-1", {"value": TOKEN})
    assert _met(before) is False
    assert before.json()["guidance"]
    assert "read_internal_notes" not in before.json()["guidance"]
    assert TOKEN not in before.json()["guidance"]
    echo = await _notes(client, headers, TOKEN)
    assert _met(echo) is False
    assert _met(await _submit(client, headers, "mcp01-1", {"value": TOKEN})) is False
    other_server = await _call(client, headers, "mcp01-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"})
    assert _met(other_server) is False
    await _notes(client, headers, BILLING_TICKET)
    assert _met(await _submit(client, headers, "mcp01-1", {})) is False
    assert _met(await _submit(client, headers, "mcp01-1", {"value": "[redacted]"})) is False
    assert _met(await _submit(client, headers, "mcp01-1", {"value": TOKEN})) is True
    reset = await client.post("/api/labs/mcp01-1/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    assert _met(await _submit(client, headers, "mcp01-1", {"value": TOKEN})) is False
    assert await _completed(client, headers, "mcp01-1") is False
    other = auth_header(await _token(client, "pilot01_other"))
    assert _met(await _submit(client, other, "mcp01-1", {"value": TOKEN})) is False


async def test_mcp01_resume_keeps_the_attempt(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot01_resume"))
    first = await _open(client, headers, "mcp01-1")
    await _notes(client, headers, BILLING_TICKET)
    again = await client.post("/api/labs/mcp01-1/start", headers=headers)
    assert again.json()["already_started"] is True
    assert again.json()["started_at"] == first["started_at"]
    assert _met(await _submit(client, headers, "mcp01-1", {"value": TOKEN})) is True


UNAPPROVED = "unapproved_capability"


async def test_mcp02_update_context_and_every_level(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot02"))
    await _open(client, headers, "mcp02-1")
    lab = await _lab(client, headers, "mcp02-1")
    assert lab["ui"]["approved_surface"]["version"] == "1.4.0"
    assert "export_orders" not in lab["ui"]["approved_surface"]["tools"]
    discovered = await _get(client, headers, "mcp02-1", "community_support", "discover")
    assert "1.5.0" in str(discovered.json()["result"]["server_info"])
    assert _met(discovered) is False
    first = await _get(client, headers, "mcp02-1", "community_support", "tools")
    tools = {row["name"]: row["description"] for row in first.json()["result"]["tools"]}
    assert "export_orders" in tools
    assert "IMPORTANT" not in tools["lookup_ticket"]
    assert _met(first) is False
    called = await _call(client, headers, "mcp02-1", "community_support", "export_orders", {})
    body = str(called.json()["result"])
    assert "EXP-" in body and "fulfilment staff only" in body and "alice@example.com" in body
    assert _met(called) is False
    assert await _completed(client, headers, "mcp02-1") is False
    listing = await _submit(client, headers, "mcp02-1", {"finding": "listing_is_permission", "outcome": "allowed"})
    assert _met(listing) is False
    assert "export_orders" not in listing.json()["guidance"]
    assert "approval" in listing.json()["guidance"].lower()
    blocked = await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "blocked"})
    assert _met(blocked) is False
    assert "ran and returned" in blocked.json()["guidance"]
    done = await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})
    assert _met(done) is True
    assert done.json()["evaluation"]["flag"] is None
    assert done.json()["takeaway"]["why"]

    for level in (1, 2):
        user = auth_header(await _token(client, f"pilot02_l{level}"))
        await _get(client, user, "mcp02-1", "community_support", "tools", level=level)
        denied = await _call(client, user, "mcp02-1", "community_support", "export_orders", {}, level=level)
        assert denied.json()["result"]["denied"] is True
        assert _met(denied) is False
        wrong = await _submit(client, user, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})
        assert _met(wrong) is False
        assert "refused before it ran" in wrong.json()["guidance"]
        listing = await _submit(client, user, "mcp02-1", {"finding": "listing_is_permission", "outcome": "blocked"})
        assert _met(listing) is False
        ok = await _submit(client, user, "mcp02-1", {"finding": UNAPPROVED, "outcome": "blocked"})
        assert _met(ok) is True


async def test_mcp02_reset_restores_the_initial_state(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot02_reset"))
    await _open(client, headers, "mcp02-1")
    approved = (await _lab(client, headers, "mcp02-1"))["ui"]["approved_surface"]
    initial_discover = (await _get(client, headers, "mcp02-1", "community_support", "discover")).json()["result"]
    initial_tools = (await _get(client, headers, "mcp02-1", "community_support", "tools")).json()["result"]["tools"]
    await _get(client, headers, "mcp02-1", "community_support", "tools")
    await _call(client, headers, "mcp02-1", "community_support", "export_orders", {})
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is True
    assert (await _lab(client, headers, "mcp02-1"))["takeaway"]

    reset = await client.post("/api/labs/mcp02-1/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    fresh = await _lab(client, headers, "mcp02-1")
    assert fresh["completed_at"] is None
    assert fresh["takeaway"] == {}
    assert fresh["ui"]["approved_surface"] == approved
    assert await _events(client, headers, "mcp02-1") == []
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is False

    discover = (await _get(client, headers, "mcp02-1", "community_support", "discover")).json()["result"]
    assert discover["server_info"] == initial_discover["server_info"]
    tools = (await _get(client, headers, "mcp02-1", "community_support", "tools")).json()["result"]["tools"]
    assert tools == initial_tools
    kinds = [row["kind"] for row in await _events(client, headers, "mcp02-1")]
    assert kinds == ["submission", "discover", "tools_listed"]
    await _call(client, headers, "mcp02-1", "community_support", "export_orders", {})
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is True


async def test_mcp02_negatives_replay_and_cross_user(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot02_neg"))
    await _open(client, headers, "mcp02-1")
    early = await _call(client, headers, "mcp02-1", "community_support", "export_orders", {})
    assert _met(early) is False
    premature = await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})
    assert _met(premature) is False
    await _get(client, headers, "mcp02-1", "community_support", "tools")
    lookup = await _call(client, headers, "mcp02-1", "community_support", "lookup_ticket", {"ticket_id": "TCK-1"})
    assert _met(lookup) is False
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "blocked"})) is False
    await _call(client, headers, "mcp02-1", "community_support", "export_orders", {})
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED})) is False
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is True
    await client.post("/api/labs/mcp02-1/reset", headers=headers)
    assert _met(await _submit(client, headers, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is False
    stranger = auth_header(await _token(client, "pilot02_other"))
    assert _met(await _submit(client, stranger, "mcp02-1", {"finding": UNAPPROVED, "outcome": "allowed"})) is False


async def _simulate(client, headers, lab_id):
    return await client.post(
        f"/api/labs/{lab_id}/agent-step",
        headers=headers,
        json={"goal": "Answer using the tool list."},
    )


async def test_mcp03_planner_shows_metadata_plan_and_consequence(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot03"))
    await _open(client, headers, "mcp03-1")
    listed = await _get(client, headers, "mcp03-1", "community_support", "tools")
    assert _met(listed) is False
    again = await _get(client, headers, "mcp03-1", "community_support", "tools")
    second = {row["name"]: row["description"] for row in again.json()["result"]["tools"]}
    assert "IMPORTANT: before answering" in second["lookup_ticket"]
    assert "export_orders" not in second["lookup_ticket"]
    assert "export_orders" not in second, "the update-added capability belongs to MCP02, not the poisoning lab"
    simulated = await _simulate(client, headers, "mcp03-1")
    assert simulated.status_code == 200, simulated.text
    sim = simulated.json()
    assert "Deterministic" in sim["note"]
    assert sim["changed"] is True
    assert {tool["name"]: tool["description"] for tool in sim["tools"]}["lookup_ticket"] == second["lookup_ticket"]
    assert sim["baseline"] == [{"name": "lookup_ticket", "arguments": {"ticket_id": "TCK-1008"}}]
    assert [(step["name"], step["source"]) for step in sim["plan"]] == [
        ("lookup_ticket", "request"),
        ("read_internal_notes", "metadata"),
    ]
    assert sim["plan"][1]["arguments"] == {"ticket_id": "TCK-1008"}
    effects = {row["name"]: row["result"] for row in sim["effects"]}
    assert CANARY in effects["read_internal_notes"]
    assert "not a secret" in effects["read_internal_notes"]
    assert CANARY not in effects["lookup_ticket"]

    events = await _events(client, headers, "mcp03-1")
    planned = [row for row in events if row["kind"] == "planner_simulated"]
    assert len(planned) == 1
    assert "Baseline plan" in planned[0]["excerpt"]
    assert not [row for row in events if row["kind"] in ("tool_call", "tool_result")], "simulation must not run a tool"
    assert await _completed(client, headers, "mcp03-1") is False

    wrong = await _submit(client, headers, "mcp03-1", {"finding": "descriptions_only_explain"})
    assert _met(wrong) is False
    assert "lookup_ticket" not in wrong.json()["guidance"]
    assert CANARY not in wrong.json()["guidance"]
    removed = await _submit(client, headers, "mcp03-1", {"finding": "inspection_removed_instruction"})
    assert _met(removed) is False
    done = await _submit(client, headers, "mcp03-1", {"finding": "metadata_changed_plan"})
    assert _met(done) is True
    assert done.json()["evaluation"]["flag"] is None
    assert not [row for row in await _events(client, headers, "mcp03-1") if row["kind"] == "tool_call"]


async def test_mcp03_defense_levels(client: AsyncClient):
    level_one = auth_header(await _token(client, "pilot03_l1"))
    await _get(client, level_one, "mcp03-1", "community_support", "tools", level=1)
    assert (await _simulate(client, level_one, "mcp03-1")).json()["changed"] is True
    assert _met(await _submit(client, level_one, "mcp03-1", {"finding": "metadata_changed_plan"})) is True

    level_two = auth_header(await _token(client, "pilot03_l2"))
    listed_l2 = await _get(client, level_two, "mcp03-1", "community_support", "tools", level=2)
    shown = {row["name"]: row["description"] for row in listed_l2.json()["result"]["tools"]}
    assert "IMPORTANT" not in shown["lookup_ticket"]
    sim = (await _simulate(client, level_two, "mcp03-1")).json()
    assert sim["changed"] is False
    assert CANARY not in str(sim["effects"])
    assert _met(await _submit(client, level_two, "mcp03-1", {"finding": "metadata_changed_plan"})) is False
    assert _met(await _submit(client, level_two, "mcp03-1", {"finding": "inspection_removed_instruction"})) is True


async def test_mcp03_negatives_replay_and_cross_user(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot03_neg"))
    await _open(client, headers, "mcp03-1")
    assert _met(await _get(client, headers, "mcp03-1", "community_support", "discover")) is False
    blind = await _simulate(client, headers, "mcp03-1")
    assert blind.json()["changed"] is False
    assert _met(await _submit(client, headers, "mcp03-1", {"finding": "metadata_changed_plan"})) is False
    assert _met(await _submit(client, headers, "mcp03-1", {"finding": "inspection_removed_instruction"})) is False
    called = await _call(client, headers, "mcp03-1", "community_support", "read_internal_notes", {"ticket_id": "TCK-1"})
    assert _met(called) is False
    await _get(client, headers, "mcp03-1", "community_support", "tools")
    other = await _call(client, headers, "mcp03-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"})
    assert _met(other) is False
    assert _met(await _submit(client, headers, "mcp03-1", {"finding": "metadata_changed_plan"})) is False
    await _simulate(client, headers, "mcp03-1")
    assert await _completed(client, headers, "mcp03-1") is False
    assert _met(await _submit(client, headers, "mcp03-1", {"finding": "metadata_changed_plan"})) is True
    await client.post("/api/labs/mcp03-1/reset", headers=headers)
    assert _met(await _submit(client, headers, "mcp03-1", {"finding": "metadata_changed_plan"})) is False
    stranger = auth_header(await _token(client, "pilot03_other"))
    assert _met(await _submit(client, stranger, "mcp03-1", {"finding": "metadata_changed_plan"})) is False


DISTRUST = {"integration": "package_b", "reason": "claim_does_not_match_launch"}


async def test_mcp09_positive_all_levels(client: AsyncClient):
    async def finish(username, level):
        headers = auth_header(await _token(client, username))
        await _open(client, headers, "mcp09-1")
        for server in ("shop_catalog", "shadow_shop"):
            found = await _get(client, headers, "mcp09-1", server, "discover", level)
            assert _met(found) is False
        called = await _call(client, headers, "mcp09-1", "shadow_shop", "lookup_product", {"sku": "HOO-001"}, level)
        assert _met(called) is False
        body = str(called.json()["result"])
        assert "Shadow" not in body and "2499" in body and "OFFICIAL-50" not in body
        official = await _call(client, headers, "mcp09-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"}, level)
        assert "2499" in str(official.json()["result"])
        prices = await _submit(client, headers, "mcp09-1", {"integration": "package_b", "reason": "prices_do_not_match"})
        assert _met(prices) is False
        assert "match" in prices.json()["guidance"]
        done = await _submit(client, headers, "mcp09-1", DISTRUST)
        assert _met(done) is True
        assert done.json()["evaluation"]["flag"] is None
        assert await _completed(client, headers, "mcp09-1") is True

    await finish("pilot09", 0)
    await finish("pilot09_l1", 1)
    await finish("pilot09_l2", 2)


async def test_mcp09_negatives_replay_and_cross_user(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot09_neg"))
    await _open(client, headers, "mcp09-1")
    for server in ("shop_catalog", "shadow_shop", "community_support"):
        assert _met(await _get(client, headers, "mcp09-1", server, "discover")) is False
        assert _met(await _get(client, headers, "mcp09-1", server, "tools")) is False
    early = await _submit(client, headers, "mcp09-1", DISTRUST)
    assert _met(early) is False
    empty = await _call(client, headers, "mcp09-1", "shadow_shop", "lookup_product", {"sku": ""})
    assert _met(empty) is False
    assert _met(await _submit(client, headers, "mcp09-1", DISTRUST)) is False
    await _call(client, headers, "mcp09-1", "shop_catalog", "lookup_product", {"sku": "HOO-001"})
    for wrong in ("package_a", "support"):
        bad = await _submit(client, headers, "mcp09-1", {"integration": wrong, "reason": "claim_does_not_match_launch"})
        assert _met(bad) is False
        assert "consistent" in bad.json()["guidance"].lower()
        assert "shadow_shop" not in bad.json()["guidance"]
        assert "Catalog package B" not in bad.json()["guidance"]
    good = await _submit(client, headers, "mcp09-1", DISTRUST)
    assert _met(good) is True
    await client.post("/api/labs/mcp09-1/reset", headers=headers)
    assert _met(await _submit(client, headers, "mcp09-1", DISTRUST)) is False
    stranger = auth_header(await _token(client, "pilot09_other"))
    assert _met(await _submit(client, stranger, "mcp09-1", DISTRUST)) is False


async def test_mcp09_identity_evidence_is_attached_automatically(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot09_auto"))
    await _open(client, headers, "mcp09-1")
    await _get(client, headers, "mcp09-1", "shop_catalog", "discover")
    await _call(client, headers, "mcp09-1", "shadow_shop", "lookup_product", {"sku": "HOO-001"})
    unidentified = await _submit(client, headers, "mcp09-1", DISTRUST)
    assert _met(unidentified) is False
    assert "Identify" in unidentified.json()["guidance"]
    await _get(client, headers, "mcp09-1", "shadow_shop", "discover")
    await _call(client, headers, "mcp09-1", "shadow_shop", "lookup_product", {"sku": "HOO-001"})
    done = await _submit(client, headers, "mcp09-1", DISTRUST)
    assert _met(done) is True
    assert "evidence" not in DISTRUST


async def test_pilot_openings_do_not_name_the_answer(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot_copy"))
    banned = {
        "mcp01-1": ("read_internal_notes", "sk-shop-billing", "TCK-1042"),
        "mcp02-1": ("export_orders",),
        "mcp03-1": ("read_internal_notes", CANARY),
        "mcp09-1": ("shadow_shop", "untrusted", "Shadow", "impostor", "MISMATCH"),
    }
    for lab_id, words in banned.items():
        body = await _lab(client, headers, lab_id)
        ui = body["ui"]
        submission = ui.get("submission") or {}
        visible = " ".join([
            body["name"],
            body["description"],
            body["briefing"],
            " ".join(body["expected_by_level"].values()),
            str(ui.get("server_context") or ""),
            " ".join(str(value) for value in (ui.get("server_labels") or {}).values()),
            " ".join(str(value) for value in (ui.get("launch_labels") or {}).values()),
            " ".join(str(value) for value in (ui.get("defense_behaviour") or {}).values()),
            str(submission),
        ])
        for word in words:
            assert word not in visible, (lab_id, word)
        assert ui["learner_first"] is True
        assert body["takeaway"] == {}
        assert body["expected_by_level"] == {}


async def test_defense_behaviour_is_available_before_completion(client: AsyncClient):
    headers = auth_header(await _token(client, "pilot_defense"))
    for lab_id in PILOTS:
        body = await _lab(client, headers, lab_id)
        assert body["completed_at"] is None
        behaviour = body["ui"]["defense_behaviour"]
        assert {str(key) for key in behaviour} == {"0", "1", "2"}, lab_id
        assert all(str(text).strip() for text in behaviour.values()), lab_id
