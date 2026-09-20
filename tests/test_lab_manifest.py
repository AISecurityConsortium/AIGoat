"""Tests for lab manifest loading and lab plugin infrastructure."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.core.lab_loader import (
    LabDefinition,
    LabManifest,
    get_all_labs,
    get_lab_by_id,
    get_lab_dict,
)


class TestLabDefinition:
    def test_required_fields(self):
        lab = LabDefinition(id="test-1", name="Test Lab", owasp="LLM01")
        assert lab.id == "test-1"
        assert lab.name == "Test Lab"
        assert lab.owasp == "LLM01"
        assert lab.status == "active"
        assert lab.defense_override is None
        assert lab.prompt_file is None
        assert lab.challenge_evaluator is None
        assert lab.description == ""

    def test_all_fields(self):
        lab = LabDefinition(
            id="test-2",
            name="Full Lab",
            owasp="LLM07",
            status="coming_soon",
            defense_override=0,
            prompt_file="system_prompt_exposure",
            challenge_evaluator="system prompt extraction",
            description="Extract the system prompt.",
        )
        assert lab.defense_override == 0
        assert lab.prompt_file == "system_prompt_exposure"
        assert lab.challenge_evaluator == "system prompt extraction"


class TestLabManifest:
    def test_empty_manifest(self):
        m = LabManifest(labs=[])
        assert m.labs == []

    def test_manifest_from_dict(self):
        data = {
            "labs": [
                {"id": "a", "name": "Lab A", "owasp": "LLM01"},
                {"id": "b", "name": "Lab B", "owasp": "LLM02"},
            ]
        }
        m = LabManifest(**data)
        assert len(m.labs) == 2
        assert m.labs[0].id == "a"
        assert m.labs[1].id == "b"

    def test_manifest_from_yaml_file(self, tmp_path: Path):
        data = {
            "labs": [
                {
                    "id": "yml-1",
                    "name": "YAML Lab",
                    "owasp": "LLM01",
                    "status": "active",
                    "defense_override": 0,
                    "prompt_file": "prompt_injection",
                    "challenge_evaluator": "prompt injection",
                    "description": "Test lab from YAML.",
                },
            ]
        }
        yml_file = tmp_path / "labs.yml"
        yml_file.write_text(yaml.dump(data))

        with open(yml_file) as f:
            loaded = yaml.safe_load(f)
        m = LabManifest(**loaded)
        assert len(m.labs) == 1
        assert m.labs[0].id == "yml-1"
        assert m.labs[0].prompt_file == "prompt_injection"


class TestGetAllLabs:
    """Tests that the real config/labs.yml loads correctly."""

    def test_labs_loaded(self):
        labs = get_all_labs()
        assert len(labs) > 0

    def test_all_labs_have_ids(self):
        for lab in get_all_labs():
            assert lab.id
            assert lab.name
            assert lab.owasp

    def test_active_labs_present(self):
        ids = {lab.id for lab in get_all_labs()}
        assert "llm01-1" in ids
        assert "llm07-1" in ids

    def test_new_labs_active(self):
        statuses = {lab.id: lab.status for lab in get_all_labs()}
        assert statuses.get("llm03-1") == "active"
        assert statuses.get("llm06-1") == "active"
        assert statuses.get("llm10-1") == "active"

    def test_no_duplicate_ids(self):
        ids = [lab.id for lab in get_all_labs()]
        assert len(ids) == len(set(ids))


class TestGetLabById:
    def test_existing_lab(self):
        lab = get_lab_by_id("llm01-1")
        assert lab is not None
        assert lab.owasp == "LLM01"

    def test_missing_lab(self):
        assert get_lab_by_id("nonexistent") is None


class TestLabManifestEnvOverride:
    """Verify LABS_CONFIG_PATH environment variable override."""

    def test_custom_path(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core import lab_loader

        data = {"labs": [{"id": "custom-1", "name": "Custom", "owasp": "LLM99"}]}
        custom_file = tmp_path / "custom_labs.yml"
        custom_file.write_text(yaml.dump(data))

        monkeypatch.setenv("LABS_CONFIG_PATH", str(custom_file))
        lab_loader.load_lab_manifest.cache_clear()

        try:
            m = lab_loader.load_lab_manifest()
            assert len(m.labs) == 1
            assert m.labs[0].id == "custom-1"
        finally:
            monkeypatch.delenv("LABS_CONFIG_PATH", raising=False)
            lab_loader.load_lab_manifest.cache_clear()


_LEGACY_LAB_DICT_KEYS = {
    "id",
    "name",
    "owasp",
    "status",
    "defense_override",
    "prompt_file",
    "challenge_evaluator",
    "description",
}


class TestExtendedLabSchema:
    def test_fourteen_labs_still_load(self):
        ids = {lab.id for lab in get_all_labs()}
        assert {
            "llm01-1", "llm01-2", "llm01-3", "llm02-1", "llm02-2", "llm02-3",
            "llm03-1", "llm04-1", "llm05-1", "llm06-1", "llm07-1", "llm08-1",
            "llm09-1", "llm10-1",
        } <= ids
        assert len(ids) >= 14

    def test_llm01_owasp_alias_unchanged(self):
        lab = get_lab_by_id("llm01-1")
        assert lab is not None
        assert lab.owasp == "LLM01"

    def test_owasp_synthesises_2025_risk(self):
        lab = LabDefinition(id="synth-1", name="Synth", owasp="LLM01")
        assert lab.risks == ("owasp-llm-2025:LLM01",)

    def test_llm01_maps_to_both_editions(self):
        lab = get_lab_by_id("llm01-1")
        assert lab is not None
        assert "owasp-llm-2025:LLM01" in lab.risks
        assert "owasp-llm-2026:LLM01" in lab.risks

    def test_default_surface_is_chat_cracky(self):
        lab = get_lab_by_id("llm01-1")
        assert lab is not None
        assert lab.surface == "chat.cracky"

    def test_llm03_defense_override_still_none(self):
        lab = get_lab_by_id("llm03-1")
        assert lab is not None
        assert lab.defense_override is None

    def test_surface_config_mirrors_defense_override(self):
        for lab in get_all_labs():
            assert lab.surface_config.get("defense_override") == lab.defense_override

    def test_get_lab_dict_keeps_legacy_keys(self):
        dumped = get_lab_dict("llm01-1")
        assert dumped is not None
        assert _LEGACY_LAB_DICT_KEYS <= set(dumped)

    def test_directory_two_files_load(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core import lab_loader

        (tmp_path / "a.yml").write_text(
            yaml.dump({"labs": [{"id": "dir-a", "name": "A", "owasp": "LLM01"}]})
        )
        (tmp_path / "b.yml").write_text(
            yaml.dump({"labs": [{"id": "dir-b", "name": "B", "owasp": "LLM02"}]})
        )
        monkeypatch.setattr(lab_loader, "_configured_labs_dir", lambda: tmp_path)
        lab_loader.load_lab_manifest.cache_clear()
        try:
            ids = {lab.id for lab in lab_loader.get_all_labs()}
            assert "dir-a" in ids
            assert "dir-b" in ids
        finally:
            lab_loader.load_lab_manifest.cache_clear()

    def test_directory_id_collision_raises(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core import lab_loader

        payload = yaml.dump({"labs": [{"id": "dup-1", "name": "Dup", "owasp": "LLM01"}]})
        (tmp_path / "one.yml").write_text(payload)
        (tmp_path / "two.yml").write_text(payload)
        monkeypatch.setattr(lab_loader, "_configured_labs_dir", lambda: tmp_path)
        lab_loader.load_lab_manifest.cache_clear()
        try:
            with pytest.raises(ValueError, match="dup-1"):
                lab_loader.load_lab_manifest()
        finally:
            lab_loader.load_lab_manifest.cache_clear()

    def test_invalid_surface_raises_naming_lab(self):
        with pytest.raises(ValueError, match="llm-bad"):
            LabDefinition(id="llm-bad", name="Bad", owasp="LLM01", surface="not.a.surface")


_ORIGINAL_LAB_IDS = (
    "llm01-1",
    "llm01-2",
    "llm01-3",
    "llm02-1",
    "llm02-2",
    "llm02-3",
    "llm03-1",
    "llm04-1",
    "llm05-1",
    "llm06-1",
    "llm07-1",
    "llm08-1",
    "llm09-1",
    "llm10-1",
)
_P7_RAG_LAB_IDS = (
    "llm01-4",
    "llm08-2",
    "llm08-3",
    "llm08-4",
    "llm02-4",
    "llm08-5",
    "llm08-6",
)
_P8_AGENT_LAB_IDS = (
    "llm06-2",
    "llm06-3",
    "asi09-1",
)
_P9_MCP_LAB_IDS = (
    "mcp03-1",
    "mcp03-2",
    "mcp01-1",
    "mcp09-1",
)
_P10_SKILL_LAB_IDS = (
    "ast01-1",
    "ast02-1",
    "ast03-1",
    "ast04-1",
    "ast05-1",
    "ast06-1",
    "ast07-1",
    "ast08-1",
    "ast09-1",
    "ast10-1",
)
_ALLOWED_DIFFICULTY = {"beginner", "intermediate", "advanced"}


class TestMigratedLabContent:
    """T021: 21 frontend cards merged into the original 14 lab ids."""

    def test_lab_count_is_fourteen_after_merge(self):
        ids = {lab.id for lab in get_all_labs()}
        assert set(_ORIGINAL_LAB_IDS) <= ids
        assert set(_P7_RAG_LAB_IDS) <= ids
        assert set(_P8_AGENT_LAB_IDS) <= ids
        assert set(_P9_MCP_LAB_IDS) <= ids
        assert set(_P10_SKILL_LAB_IDS) <= ids
        assert len(ids) == (
            len(_ORIGINAL_LAB_IDS)
            + len(_P7_RAG_LAB_IDS)
            + len(_P8_AGENT_LAB_IDS)
            + len(_P9_MCP_LAB_IDS)
            + len(_P10_SKILL_LAB_IDS)
        )

    def test_original_ids_still_resolve(self):
        for lab_id in _ORIGINAL_LAB_IDS:
            assert get_lab_by_id(lab_id) is not None, lab_id

    def test_p8_agent_labs_use_agent_runner_surface(self):
        for lab_id in _P8_AGENT_LAB_IDS:
            lab = get_lab_by_id(lab_id)
            assert lab is not None, lab_id
            assert lab.surface == "agent.runner", lab_id

    def test_p9_mcp_labs_use_mcp_client_surface(self):
        for lab_id in _P9_MCP_LAB_IDS:
            lab = get_lab_by_id(lab_id)
            assert lab is not None, lab_id
            assert lab.surface == "mcp.client", lab_id

    def test_p10_skill_labs_use_skill_runtime_surface(self):
        for lab_id in _P10_SKILL_LAB_IDS:
            lab = get_lab_by_id(lab_id)
            assert lab is not None, lab_id
            assert lab.surface == "skill.runtime", lab_id

    def test_p7_rag_labs_use_rag_kb_surface(self):
        for lab_id in ("llm02-3", "llm08-1", *_P7_RAG_LAB_IDS):
            lab = get_lab_by_id(lab_id)
            assert lab is not None, lab_id
            assert lab.surface == "rag.kb", lab_id

    def test_every_lab_has_objective_and_payloads(self):
        for lab in get_all_labs():
            assert lab.objective.strip(), lab.id
            assert lab.example_payloads, lab.id

    def test_every_lab_has_three_expected_levels(self):
        for lab in get_all_labs():
            assert set(lab.expected_by_level) == {0, 1, 2}, lab.id

    def test_difficulty_is_allowed(self):
        for lab in get_all_labs():
            assert lab.difficulty in _ALLOWED_DIFFICULTY, lab.id

    def test_risks_are_qualified(self):
        for lab in get_all_labs():
            assert lab.risks, lab.id
            assert all(r.startswith("owasp-") for r in lab.risks), lab.id

    def test_evaluated_labs_have_prompt_file(self):
        for lab in get_all_labs():
            if lab.challenge_evaluator:
                assert lab.prompt_file, lab.id


class TestDualFrameworkMapping:
    """T040: every lab maps to both the 2025 and 2026 LLM editions."""

    def test_every_lab_has_both_editions(self):
        for lab in get_all_labs():
            assert len(lab.risks) >= 2, lab.id
            assert any(r.startswith("owasp-llm-2025:") for r in lab.risks), lab.id
            assert any(r.startswith("owasp-llm-2026:") for r in lab.risks), lab.id

    def test_llm07_lab_maps_to_hidden_context_exposure(self):
        lab = get_lab_by_id("llm07-1")
        assert lab is not None
        assert "owasp-llm-2026:LLM08" in lab.risks

    def test_llm06_lab_maps_to_excessive_agency_third(self):
        lab = get_lab_by_id("llm06-1")
        assert lab is not None
        assert "owasp-llm-2026:LLM03" in lab.risks

    def test_legacy_owasp_alias_still_2025(self):
        lab = get_lab_by_id("llm07-1")
        assert lab is not None
        assert lab.owasp == "LLM07"
