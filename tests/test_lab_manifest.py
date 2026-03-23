"""Tests for lab manifest loading and lab plugin infrastructure."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.core.lab_loader import LabDefinition, LabManifest, get_all_labs, get_lab_by_id


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
