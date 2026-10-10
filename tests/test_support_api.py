"""Support tickets: customers plant text, admin reads every ticket."""
from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import User
from tests.conftest import auth_header


async def _signup(client: AsyncClient, username: str) -> str:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def test_customer_creates_and_lists_own_ticket(client: AsyncClient):
    token = await _signup(client, "ticket_alice")
    created = await client.post(
        "/api/support/tickets/",
        headers=auth_header(token),
        json={"subject": "Late order", "body": "Please check order 1001."},
    )
    assert created.status_code == 200, created.text
    assert created.json()["subject"] == "Late order"
    listed = await client.get("/api/support/tickets/", headers=auth_header(token))
    assert listed.status_code == 200
    assert any(row["subject"] == "Late order" for row in listed.json())


async def test_admin_lists_all_and_customer_cannot(client: AsyncClient, db: AsyncSession):
    customer = await _signup(client, "ticket_bob")
    await client.post(
        "/api/support/tickets/",
        headers=auth_header(customer),
        json={"subject": "Refund please", "body": "The mug arrived cracked."},
    )
    denied = await client.get("/api/admin/support/tickets/", headers=auth_header(customer))
    assert denied.status_code == 403

    db.add(User(
        username="ticket_admin",
        email="ticket_admin@aigoatshop.com",
        password_hash=hash_password("admin123"),
        is_staff=True,
        is_superuser=True,
        is_active=True,
    ))
    await db.commit()
    admin = await client.post("/api/auth/login/", json={"username": "ticket_admin", "password": "admin123"})
    assert admin.status_code == 200, admin.text
    token = admin.json()["token"]
    listed = await client.get("/api/admin/support/tickets/", headers=auth_header(token))
    assert listed.status_code == 200
    match = next(row for row in listed.json() if row["subject"] == "Refund please")
    closed = await client.patch(
        f"/api/admin/support/tickets/{match['id']}/",
        headers=auth_header(token),
        json={"status": "closed"},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["status"] == "closed"
    feedback = await client.get("/api/admin/feedback/", headers=auth_header(token))
    assert feedback.status_code == 200
    assert any(row["id"] == match["id"] and row["status"] == "closed" for row in feedback.json())


async def test_attachment_thread_and_admin_reply(client: AsyncClient, db: AsyncSession):
    owner = await _signup(client, "ticket_owner")
    created = await client.post(
        "/api/support/tickets/",
        headers=auth_header(owner),
        data={"subject": "Photo of the mug", "body": "The crack is in the photo."},
        files={"file": ("crack.txt", b"photo-bytes", "text/plain")},
    )
    assert created.status_code == 200, created.text
    ticket = created.json()
    opening = ticket["messages"][0]
    assert opening["attachment_name"] == "crack.txt"
    assert "attachment_stored" not in opening

    downloaded = await client.get(
        f"/api/support/tickets/{ticket['id']}/messages/{opening['id']}/file",
        headers=auth_header(owner),
    )
    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == b"photo-bytes"

    stranger = await _signup(client, "ticket_stranger")
    blocked = await client.get(
        f"/api/support/tickets/{ticket['id']}/messages/{opening['id']}/file",
        headers=auth_header(stranger),
    )
    assert blocked.status_code == 403
    blocked_reply = await client.post(
        f"/api/support/tickets/{ticket['id']}/messages/",
        headers=auth_header(stranger),
        json={"body": "not my ticket"},
    )
    assert blocked_reply.status_code == 403

    owner_reply = await client.post(
        f"/api/support/tickets/{ticket['id']}/messages/",
        headers=auth_header(owner),
        json={"body": "Any update?"},
    )
    assert owner_reply.status_code == 200, owner_reply.text
    assert [row["body"] for row in owner_reply.json()["messages"]] == ["The crack is in the photo.", "Any update?"]

    db.add(User(
        username="ticket_staff",
        email="ticket_staff@aigoatshop.com",
        password_hash=hash_password("admin123"),
        is_staff=True,
        is_superuser=True,
        is_active=True,
    ))
    await db.commit()
    admin = await client.post("/api/auth/login/", json={"username": "ticket_staff", "password": "admin123"})
    token = admin.json()["token"]
    staff_reply = await client.post(
        f"/api/admin/support/tickets/{ticket['id']}/messages/",
        headers=auth_header(token),
        json={"body": "We can replace it."},
    )
    assert staff_reply.status_code == 200, staff_reply.text
    listed = await client.get("/api/support/tickets/", headers=auth_header(owner))
    row = next(item for item in listed.json() if item["id"] == ticket["id"])
    assert row["messages"][-1]["username"] == "ticket_staff"
    assert row["messages"][-1]["body"] == "We can replace it."

    closed = await client.patch(
        f"/api/admin/support/tickets/{ticket['id']}/",
        headers=auth_header(token),
        json={"status": "closed"},
    )
    assert closed.status_code == 200
    denied = await client.post(
        f"/api/support/tickets/{ticket['id']}/messages/",
        headers=auth_header(owner),
        json={"body": "one more thing"},
    )
    assert denied.status_code == 422
