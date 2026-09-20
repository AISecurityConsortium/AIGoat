"""Tests for the in-memory taxonomy cross-mapping index (T012)."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.core.framework_loader import reset_framework_cache
from app.core.lab_loader import load_lab_manifest
from app.core.taxonomy import (
    build_index,
    challenges_for_risk,
    coverage_summary,
    labs_for_risk,
    related_risks,
    reset_index,
    risks_for_lab,
)


def _reset_all() -> None:
    reset_framework_cache()
    load_lab_manifest.cache_clear()
    reset_index()


class TestTaxonomyIndex:
    def setup_method(self) -> None:
        _reset_all()

    def teardown_method(self) -> None:
        _reset_all()

    def test_labs_for_llm01_2025(self):
        labs = labs_for_risk("owasp-llm-2025:LLM01")
        assert "llm01-1" in labs
        assert "llm01-2" in labs
        assert "llm01-3" in labs

    def test_risks_for_lab_llm01(self):
        risks = risks_for_lab("llm01-1")
        assert any(risk.code == "LLM01" for risk in risks)

    def test_related_risks_cross_framework(self):
        related = related_risks("owasp-llm-2026:LLM01")
        assert any(risk.id.startswith("owasp-agentic-2026:") for risk in related)

    def test_challenges_for_llm01(self):
        assert 1 in challenges_for_risk("owasp-llm-2025:LLM01")

    def test_coverage_summary_shape(self):
        rows = coverage_summary()
        assert len(rows) == 5
        by_id = {row["framework_id"]: row for row in rows}
        llm2025 = by_id["owasp-llm-2025"]
        assert llm2025["risk_count"] == 10
        assert llm2025["covered_risk_count"] > 0
        assert llm2025["lab_count"] > 0
        assert llm2025["covered_risk_count"] <= llm2025["risk_count"]

    def test_unknown_lab_risk_raises(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        frameworks_dir = tmp_path / "frameworks"
        frameworks_dir.mkdir()
        frameworks_dir.joinpath("tiny.yml").write_text(
            yaml.safe_dump(
                {
                    "id": "tiny",
                    "name": "Tiny",
                    "version": "1",
                    "status": "stable",
                    "publisher": "AIGoat",
                    "url": "https://example.invalid/tiny",
                    "source_license": "CC-BY-SA-4.0",
                    "attribution": "test",
                    "prose_origin": "aigoat-original",
                    "risks": [
                        {
                            "code": "R01",
                            "title": "One",
                            "summary": "s",
                            "description": "d",
                        }
                    ],
                }
            )
        )
        labs_file = tmp_path / "labs.yml"
        labs_file.write_text(
            yaml.dump(
                {
                    "labs": [
                        {
                            "id": "bad-lab",
                            "name": "Bad",
                            "owasp": "LLM01",
                            "risks": ["owasp-llm-2026:LLM99"],
                        }
                    ]
                }
            )
        )
        monkeypatch.setenv("FRAMEWORKS_CONFIG_PATH", str(frameworks_dir))
        monkeypatch.setenv("LABS_CONFIG_PATH", str(labs_file))
        _reset_all()
        try:
            with pytest.raises(ValueError, match="bad-lab"):
                build_index()
        finally:
            monkeypatch.delenv("FRAMEWORKS_CONFIG_PATH", raising=False)
            monkeypatch.delenv("LABS_CONFIG_PATH", raising=False)
            _reset_all()

    def test_index_is_cached(self):
        first = build_index()
        second = build_index()
        assert first is second

    def test_2026_rename_llm07_to_llm08(self):
        # LLM07:2025 System Prompt Leakage became LLM08:2026 Hidden Context Exposure.
        assert "llm07-1" in labs_for_risk("owasp-llm-2026:LLM08")

    def test_2026_excessive_agency_moved_to_third(self):
        assert "llm06-1" in labs_for_risk("owasp-llm-2026:LLM03")

    def test_2026_coverage_is_non_zero(self):
        by_id = {row["framework_id"]: row for row in coverage_summary()}
        assert by_id["owasp-llm-2026"]["covered_risk_count"] > 0

    def test_index_builds_quickly(self):
        import time

        reset_index()
        started = time.perf_counter()
        build_index()
        elapsed_ms = (time.perf_counter() - started) * 1000
        assert elapsed_ms < 250
