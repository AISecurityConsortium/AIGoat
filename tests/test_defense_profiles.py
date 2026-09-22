"""T061: defense profile loader and (surface, level) resolver."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.defense.profiles import (
    all_surfaces,
    load_defense_profiles,
    reset_profiles_cache,
    resolve_profile,
)

_REAL = Path(__file__).resolve().parent.parent / "config" / "defense_profiles.yml"


@pytest.fixture(autouse=True)
def _reset_profiles():
    reset_profiles_cache()
    yield
    reset_profiles_cache()


def test_all_surfaces_are_the_five_known():
    assert all_surfaces() == (
        "chat.cracky",
        "rag.kb",
        "agent.runner",
        "mcp.client",
        "api.raw",
    )


def test_every_surface_resolves_at_0_1_2():
    for surface in all_surfaces():
        for level in (0, 1, 2):
            profile = resolve_profile(surface, level)
            assert profile.surface == surface
            assert profile.level == level


def test_chat_level_zero_has_no_controls():
    assert resolve_profile("chat.cracky", 0).controls == ()


def test_level_zero_empty_on_every_surface():
    for surface in all_surfaces():
        assert resolve_profile(surface, 0).controls == ()


def test_chat_l1_contains_validate_and_moderate():
    controls = resolve_profile("chat.cracky", 1).controls
    assert "input.validate" in controls
    assert "output.moderate" in controls


def test_every_surface_level_has_nonempty_intent():
    load_defense_profiles()
    for surface in all_surfaces():
        for level in (0, 1, 2):
            intent = resolve_profile(surface, level).intent
            assert intent.strip(), f"{surface} L{level} has empty intent"


def test_l2_keeps_l1_control_families():
    for surface in all_surfaces():
        l1 = {c.split(".", 1)[0] for c in resolve_profile(surface, 1).controls}
        l2 = {c.split(".", 1)[0] for c in resolve_profile(surface, 2).controls}
        assert l1 <= l2, f"{surface}: L1 families {l1} missing from L2 {l2}"
        assert len(resolve_profile(surface, 2).controls) >= len(resolve_profile(surface, 1).controls)


def test_unknown_surface_raises():
    with pytest.raises(ValueError, match="not-a-surface"):
        resolve_profile("not-a-surface", 1)


def test_level_three_raises():
    with pytest.raises(ValueError, match="3"):
        resolve_profile("chat.cracky", 3)


def _write_profiles(tmp_path: Path, mutate) -> Path:
    data = yaml.safe_load(_REAL.read_text())
    mutate(data)
    dest = tmp_path / "defense_profiles.yml"
    dest.write_text(yaml.safe_dump(data))
    return dest


def test_unregistered_control_id_raises(tmp_path, monkeypatch):
    path = _write_profiles(
        tmp_path,
        lambda data: data["profiles"]["chat.cracky"][1]["controls"].append("not.a.control"),
    )
    monkeypatch.setenv("DEFENSE_PROFILES_PATH", str(path))
    reset_profiles_cache()
    with pytest.raises(ValueError, match="not.a.control"):
        load_defense_profiles()


def test_missing_intent_raises(tmp_path, monkeypatch):
    path = _write_profiles(
        tmp_path,
        lambda data: data["profiles"]["chat.cracky"][1].pop("intent"),
    )
    monkeypatch.setenv("DEFENSE_PROFILES_PATH", str(path))
    reset_profiles_cache()
    with pytest.raises(ValueError, match="intent"):
        load_defense_profiles()


def test_control_at_level_zero_raises(tmp_path, monkeypatch):
    path = _write_profiles(
        tmp_path,
        lambda data: data["profiles"]["chat.cracky"][0].__setitem__(
            "controls", ["input.validate"]
        ),
    )
    monkeypatch.setenv("DEFENSE_PROFILES_PATH", str(path))
    reset_profiles_cache()
    with pytest.raises(ValueError, match="level 0"):
        load_defense_profiles()
