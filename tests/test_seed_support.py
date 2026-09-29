"""Demo feedback tickets are inserted once and left alone on the next run."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import SupportMessage, SupportTicket, User
from scripts.seed import SUPPORT_TICKET_FIXTURES, seed_support_tickets


async def test_support_seed_is_idempotent(db: AsyncSession):
    names = {spec["username"] for spec in SUPPORT_TICKET_FIXTURES}
    names.add("admin")
    for name in sorted(names):
        db.add(User(
            username=name,
            email=f"{name}@aigoatshop.com",
            password_hash=hash_password("password123"),
            is_staff=name == "admin",
            is_active=True,
        ))
    await db.commit()
    users = list((await db.execute(select(User))).scalars().all())

    await seed_support_tickets(db, users)
    users = list((await db.execute(select(User))).scalars().all())
    await seed_support_tickets(db, users)

    fixture_subjects = {spec["subject"] for spec in SUPPORT_TICKET_FIXTURES}
    tickets = [
        ticket
        for ticket in (await db.execute(select(SupportTicket))).scalars().all()
        if ticket.subject in fixture_subjects
    ]
    assert len(tickets) == len(SUPPORT_TICKET_FIXTURES)
    subjects = {ticket.subject for ticket in tickets}
    assert "Where is my hoodie?" in subjects
    assert "Order arrived, thank you" in subjects
    closed = [ticket for ticket in tickets if ticket.status == "closed"]
    assert len(closed) == 2
    ticket_ids = [ticket.id for ticket in tickets]
    message_count = await db.scalar(
        select(func.count()).select_from(SupportMessage).where(SupportMessage.ticket_id.in_(ticket_ids))
    )
    expected = sum(len(spec["messages"]) for spec in SUPPORT_TICKET_FIXTURES)
    assert message_count == expected
