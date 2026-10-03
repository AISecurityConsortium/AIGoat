"""Evidence store: sequence, isolation, reset, and the event cap."""
from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import func, select

from app.mcp.evidence import MAX_EVENTS, append_events
from app.models.lab import LabEvent
from tests.conftest import auth_header


async def _token(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def _user_id(db, username: str) -> int:
    from app.models import User

    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one().id


async def test_operations_are_sequenced_per_attempt(client: AsyncClient, db):
    token = await _token(client, "ev_seq")
    headers = auth_header(token)
    for server in ("shop_catalog", "shadow_shop"):
        resp = await client.get(
            f"/api/mcp/servers/{server}/discover",
            headers=headers,
            params={"lab_id": "mcp09-1"},
        )
        assert resp.status_code == 200, resp.text
    user_id = await _user_id(db, "ev_seq")
    result = await db.execute(
        select(LabEvent.seq, LabEvent.kind, LabEvent.server_id).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == "mcp09-1",
        ).order_by(LabEvent.seq)
    )
    rows = result.all()
    assert [row.seq for row in rows] == [1, 2]
    assert [row.server_id for row in rows] == ["shop_catalog", "shadow_shop"]
    assert {row.kind for row in rows} == {"discover"}


async def test_reset_hides_the_previous_attempt(client: AsyncClient, db):
    token = await _token(client, "ev_reset")
    headers = auth_header(token)
    await client.get(
        "/api/mcp/servers/shop_catalog/discover",
        headers=headers,
        params={"lab_id": "mcp09-1"},
    )
    reset = await client.post("/api/labs/mcp09-1/reset", headers=headers)
    assert reset.status_code == 200, reset.text
    await client.get(
        "/api/mcp/servers/shadow_shop/discover",
        headers=headers,
        params={"lab_id": "mcp09-1"},
    )
    user_id = await _user_id(db, "ev_reset")
    result = await db.execute(
        select(LabEvent.attempt, LabEvent.server_id).where(
            LabEvent.user_id == user_id,
            LabEvent.lab_id == "mcp09-1",
        ).order_by(LabEvent.attempt, LabEvent.seq)
    )
    rows = result.all()
    assert [row.attempt for row in rows] == [1, 2]
    assert rows[1].server_id == "shadow_shop"


async def test_users_do_not_share_evidence(client: AsyncClient, db):
    token_a = await _token(client, "ev_a")
    token_b = await _token(client, "ev_b")
    await client.get(
        "/api/mcp/servers/shop_catalog/discover",
        headers=auth_header(token_a),
        params={"lab_id": "mcp09-1"},
    )
    user_b = await _user_id(db, "ev_b")
    result = await db.execute(
        select(func.count()).select_from(LabEvent).where(LabEvent.user_id == user_b)
    )
    assert int(result.scalar_one()) == 0
    assert token_b


async def test_event_cap_writes_one_truncated_marker(db):
    user_id = 900001
    lab_id = "cap-lab"
    for index in range(MAX_EVENTS + 3):
        await append_events(db, user_id, lab_id, [{"kind": "discover", "server_id": "shop_catalog", "data": {"n": index}}])
    result = await db.execute(
        select(LabEvent.kind).where(LabEvent.user_id == user_id, LabEvent.lab_id == lab_id)
    )
    kinds = [row[0] for row in result.all()]
    assert kinds.count("discover") == MAX_EVENTS
    assert kinds.count("evidence_truncated") == 1
