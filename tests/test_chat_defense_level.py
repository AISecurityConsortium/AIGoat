"""Defense level precedence for chat requests (T006).

Decision D15: a lab's ``defense_override`` is a recommended STARTING level, not a
hard pin. Precedence, highest first:

    1. body.defense_level   -- the learner explicitly chose a level this session
    2. lab defense_override -- the lab's recommended starting level
    3. user.defense_level   -- the stored per-user setting

Before this change the lab override won unconditionally, so on the 11 labs that
pin level 0 the defense toggle appeared to work but was silently ignored.

These call ``_prepare_chat`` directly because it is the only place the resolved
level is observable; the HTTP response does not expose it.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.chat import _prepare_chat
from app.core.security import hash_password
from app.models import User
from app.schemas.chat import ChatRequest

# From config/labs.yml: llm01-1 pins level 0, llm03-1 leaves the override null.
PINNED_LAB = "llm01-1"
UNPINNED_LAB = "llm03-1"


async def _make_user(db: AsyncSession, username: str, level: int) -> User:
    user = User(
        username=username,
        email=f"{username}@aigoatshop.com",
        password_hash=hash_password("password123"),
        defense_level=level,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _resolve_level(db: AsyncSession, user: User, **body_kwargs) -> int:
    body = ChatRequest(message="hello", **body_kwargs)
    prepared = await _prepare_chat(body, user, db)
    assert isinstance(prepared, dict), f"chat was blocked, not prepared: {prepared}"
    return prepared["level"]


class TestPrecedence:
    async def test_no_lab_no_explicit_uses_stored_user_level(self, db: AsyncSession):
        user = await _make_user(db, "prec_stored", level=1)
        assert await _resolve_level(db, user) == 1

    async def test_pinned_lab_without_explicit_uses_lab_override(self, db: AsyncSession):
        """Default behaviour is unchanged: the lab's recommendation applies."""
        user = await _make_user(db, "prec_labdefault", level=2)
        assert await _resolve_level(db, user, lab_id=PINNED_LAB) == 0

    async def test_explicit_level_overrides_pinned_lab(self, db: AsyncSession):
        """The regression this task exists to fix."""
        user = await _make_user(db, "prec_explicit", level=0)
        assert await _resolve_level(db, user, lab_id=PINNED_LAB, defense_level=2) == 2

    async def test_explicit_level_applies_on_unpinned_lab(self, db: AsyncSession):
        user = await _make_user(db, "prec_unpinned", level=0)
        assert await _resolve_level(db, user, lab_id=UNPINNED_LAB, defense_level=1) == 1

    async def test_unpinned_lab_without_explicit_falls_back_to_user(self, db: AsyncSession):
        user = await _make_user(db, "prec_fallback", level=1)
        assert await _resolve_level(db, user, lab_id=UNPINNED_LAB) == 1

    async def test_explicit_level_zero_is_honoured_not_treated_as_unset(self, db: AsyncSession):
        """0 is falsy; the implementation must check `is not None`, not truthiness."""
        user = await _make_user(db, "prec_zero", level=2)
        assert await _resolve_level(db, user, defense_level=0) == 0


class TestValidation:
    def test_out_of_range_level_is_rejected(self):
        with pytest.raises(Exception):
            ChatRequest(message="x", defense_level=5)

    def test_negative_level_is_rejected(self):
        with pytest.raises(Exception):
            ChatRequest(message="x", defense_level=-1)

    def test_absent_level_defaults_to_none(self):
        assert ChatRequest(message="x").defense_level is None


class TestNoPersistence:
    async def test_explicit_level_does_not_mutate_stored_user_level(self, db: AsyncSession):
        user = await _make_user(db, "prec_nopersist", level=0)
        await _resolve_level(db, user, defense_level=2)

        refreshed = (
            await db.execute(select(User).where(User.username == "prec_nopersist"))
        ).scalar_one()
        assert refreshed.defense_level == 0, (
            "a per-request level must be transient and must never be written back"
        )


class TestExistingLabDefaultsUnchanged:
    async def test_every_lab_resolves_to_its_declared_override(self, db: AsyncSession):
        """No lab's default starting level may change as a result of T006."""
        from app.core.lab_loader import get_all_labs

        user = await _make_user(db, "prec_alllabs", level=1)
        for lab in get_all_labs():
            resolved = await _resolve_level(db, user, lab_id=lab.id)
            expected = (
                lab.defense_override if lab.defense_override is not None else user.defense_level
            )
            assert resolved == expected, f"{lab.id} resolved to {resolved}, expected {expected}"
