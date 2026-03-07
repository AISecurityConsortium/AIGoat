"""Unit tests for the dynamic flag engine."""
from __future__ import annotations

import pytest

from app.challenges.engine import compute_flag, init_flag_engine, verify_flag


@pytest.fixture(autouse=True)
def _init_engine():
    init_flag_engine("unit-test-secret-key")


class TestFlagEngine:
    def test_flag_format(self):
        flag = compute_flag(challenge_id=1, user_id=42)
        assert flag.startswith("AIGOAT{")
        assert flag.endswith("}")
        inner = flag[7:-1]
        assert len(inner) == 32
        assert inner == inner.upper()

    def test_deterministic(self):
        a = compute_flag(1, 42)
        b = compute_flag(1, 42)
        assert a == b

    def test_different_users_different_flags(self):
        a = compute_flag(1, 1)
        b = compute_flag(1, 2)
        assert a != b

    def test_different_challenges_different_flags(self):
        a = compute_flag(1, 1)
        b = compute_flag(2, 1)
        assert a != b

    def test_verify_correct(self):
        flag = compute_flag(3, 10)
        assert verify_flag(3, 10, flag) is True

    def test_verify_wrong(self):
        assert verify_flag(3, 10, "AIGOAT{0000000000000000000000000000}") is False

    def test_verify_strips_whitespace(self):
        flag = compute_flag(1, 1)
        assert verify_flag(1, 1, f"  {flag}  ") is True

    def test_different_secret_different_flags(self):
        flag_a = compute_flag(1, 1)
        init_flag_engine("different-secret")
        flag_b = compute_flag(1, 1)
        assert flag_a != flag_b
        init_flag_engine("unit-test-secret-key")

    def test_uninitialized_raises(self):
        from app.challenges import engine
        old = engine._runtime_secret
        engine._runtime_secret = None
        with pytest.raises(RuntimeError):
            compute_flag(1, 1)
        engine._runtime_secret = old
