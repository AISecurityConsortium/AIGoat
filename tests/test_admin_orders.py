"""Admin order refund endpoint and status transitions."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Order, User
from tests.conftest import auth_header


async def _admin(client: AsyncClient, db: AsyncSession, username: str) -> str:
    db.add(User(
        username=username,
        email=f"{username}@aigoatshop.com",
        password_hash=hash_password("admin123"),
        is_staff=True,
        is_active=True,
    ))
    await db.commit()
    resp = await client.post(
        "/api/auth/login/",
        json={"username": username, "password": "admin123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


async def _customer_id(client: AsyncClient, db: AsyncSession, username: str) -> int:
    resp = await client.post(
        "/api/auth/signup/",
        json={"username": username, "password": "password123", "email": f"{username}@aigoatshop.com"},
    )
    assert resp.status_code == 200, resp.text
    row = await db.execute(select(User.id).where(User.username == username))
    return int(row.scalar_one())


@pytest.mark.asyncio
async def test_refund_marks_order_refunded_and_reports_amount(client: AsyncClient, db: AsyncSession):
    uid = await _customer_id(client, db, "refund_cust_1")
    order = Order(user_id=uid, total_amount=50, final_amount=45, status="delivered")
    db.add(order)
    await db.commit()
    await db.refresh(order)
    admin = await _admin(client, db, "refund_admin_1")

    resp = await client.post(f"/api/admin/orders/{order.id}/refund/", headers=auth_header(admin))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["order"]["status"] == "refunded"
    assert body["order"]["refunded_amount"] == "45.00"

    # A second refund attempt proves the status persisted to the database.
    again = await client.post(f"/api/admin/orders/{order.id}/refund/", headers=auth_header(admin))
    assert again.status_code == 422, again.text


@pytest.mark.asyncio
async def test_refund_is_rejected_when_already_refunded(client: AsyncClient, db: AsyncSession):
    uid = await _customer_id(client, db, "refund_cust_2")
    order = Order(user_id=uid, total_amount=20, status="refunded")
    db.add(order)
    await db.commit()
    await db.refresh(order)
    admin = await _admin(client, db, "refund_admin_2")

    resp = await client.post(f"/api/admin/orders/{order.id}/refund/", headers=auth_header(admin))
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_update_order_accepts_refunded_status(client: AsyncClient, db: AsyncSession):
    uid = await _customer_id(client, db, "refund_cust_3")
    order = Order(user_id=uid, total_amount=30, status="delivered")
    db.add(order)
    await db.commit()
    await db.refresh(order)
    admin = await _admin(client, db, "refund_admin_3")

    resp = await client.put(
        f"/api/admin/orders/{order.id}/",
        json={"status": "refunded"},
        headers=auth_header(admin),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["order"]["status"] == "refunded"


@pytest.mark.asyncio
async def test_refund_requires_admin(client: AsyncClient, db: AsyncSession):
    uid = await _customer_id(client, db, "refund_cust_4")
    order = Order(user_id=uid, total_amount=15, status="delivered")
    db.add(order)
    await db.commit()
    await db.refresh(order)
    token = (await client.post(
        "/api/auth/login/",
        json={"username": "refund_cust_4", "password": "password123"},
    )).json()["token"]

    resp = await client.post(f"/api/admin/orders/{order.id}/refund/", headers=auth_header(token))
    assert resp.status_code in (401, 403), resp.text
