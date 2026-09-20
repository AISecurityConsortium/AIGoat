"""Schema tests for config/frameworks/*.yml (T010)."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

FRAMEWORKS_DIR = Path(__file__).resolve().parent.parent / "config" / "frameworks"
ALLOWED_STATUS = {"stable", "draft", "release_candidate", "beta"}
ALLOWED_SURFACES = {
    "chat.cracky",
    "rag.kb",
    "agent.runner",
    "mcp.client",
    "skill.runtime",
    "api.raw",
}


def _yml_files() -> list[Path]:
    return sorted(FRAMEWORKS_DIR.glob("*.yml"))


def _load_all() -> dict[str, dict]:
    loaded: dict[str, dict] = {}
    for path in _yml_files():
        with path.open() as f:
            data = yaml.safe_load(f)
        assert data is not None, f"{path.name} parsed as empty"
        loaded[path.stem] = data
    return loaded


class TestFrameworkManifestFiles:
    def test_five_yaml_files_exist(self):
        stems = {p.stem for p in _yml_files()}
        assert stems == {
            "owasp-llm-2026",
            "owasp-llm-2025",
            "owasp-agentic-2026",
            "owasp-mcp-2025",
            "owasp-skills-2026",
        }

    def test_every_file_parses_as_yaml(self):
        for path in _yml_files():
            with path.open() as f:
                data = yaml.safe_load(f)
            assert isinstance(data, dict), path.name

    def test_id_equals_filename_stem(self):
        for path in _yml_files():
            with path.open() as f:
                data = yaml.safe_load(f)
            assert data["id"] == path.stem, path.name

    def test_prose_origin_is_aigoat_original(self):
        for path in _yml_files():
            with path.open() as f:
                data = yaml.safe_load(f)
            assert data.get("prose_origin") == "aigoat-original", path.name

    def test_status_is_allowed(self):
        for path in _yml_files():
            with path.open() as f:
                data = yaml.safe_load(f)
            assert data["status"] in ALLOWED_STATUS, path.name


class TestFrameworkRisks:
    def test_each_framework_has_exactly_ten_unique_codes(self):
        loaded = _load_all()
        total = 0
        for stem, data in loaded.items():
            codes = [r["code"] for r in data["risks"]]
            assert len(codes) == 10, stem
            assert len(set(codes)) == 10, stem
            total += len(codes)
        assert total == 50

    def test_summaries_and_descriptions_are_non_empty(self):
        for stem, data in _load_all().items():
            for risk in data["risks"]:
                assert str(risk.get("summary") or "").strip(), f"{stem}:{risk.get('code')}"
                assert str(risk.get("description") or "").strip(), f"{stem}:{risk.get('code')}"

    def test_attack_surfaces_are_in_the_fixed_set(self):
        for stem, data in _load_all().items():
            for risk in data["risks"]:
                for surface in risk.get("attack_surfaces") or []:
                    assert surface in ALLOWED_SURFACES, f"{stem}:{risk['code']} {surface}"

    def test_related_entries_are_qualified_and_resolve(self):
        loaded = _load_all()
        known = {
            f"{stem}:{risk['code']}"
            for stem, data in loaded.items()
            for risk in data["risks"]
        }
        for stem, data in loaded.items():
            for risk in data["risks"]:
                for related in risk.get("related") or []:
                    assert ":" in related, f"{stem}:{risk['code']} bare related {related!r}"
                    framework_id, _, code = related.partition(":")
                    assert framework_id, related
                    assert code, related
                    assert related in known, f"{stem}:{risk['code']} -> {related}"


def _minimal_framework_yaml(
    stem: str,
    *,
    prose_origin: str | None = "aigoat-original",
    duplicate_code: bool = False,
) -> str:
    risks = [
        {
            "code": "R01",
            "title": "One",
            "summary": "s1",
            "description": "d1",
        }
    ]
    if duplicate_code:
        risks.append(
            {
                "code": "R01",
                "title": "Dup",
                "summary": "s2",
                "description": "d2",
            }
        )
    payload: dict = {
        "id": stem,
        "name": "Tiny",
        "version": "1",
        "status": "stable",
        "publisher": "AIGoat",
        "url": "https://example.invalid/tiny",
        "source_license": "CC-BY-SA-4.0",
        "attribution": "test",
        "risks": risks,
    }
    if prose_origin is not None:
        payload["prose_origin"] = prose_origin
    return yaml.safe_dump(payload)


class TestFrameworkLoader:
    def test_get_all_frameworks_returns_five(self):
        from app.core.framework_loader import get_all_frameworks, reset_framework_cache

        reset_framework_cache()
        assert len(get_all_frameworks()) == 5

    def test_get_framework_by_id_has_ten_risks(self):
        from app.core.framework_loader import get_framework_by_id, reset_framework_cache

        reset_framework_cache()
        fw = get_framework_by_id("owasp-llm-2026")
        assert fw is not None
        assert len(fw.risks) == 10

    def test_get_risk_by_id_prompt_injection(self):
        from app.core.framework_loader import get_risk_by_id, reset_framework_cache

        reset_framework_cache()
        risk = get_risk_by_id("owasp-llm-2026:LLM01")
        assert risk is not None
        assert risk.title == "Prompt Injection"
        assert risk.id == "owasp-llm-2026:LLM01"

    def test_get_risk_by_id_missing(self):
        from app.core.framework_loader import get_risk_by_id, reset_framework_cache

        reset_framework_cache()
        assert get_risk_by_id("nope:XX") is None

    def test_get_all_risks_returns_fifty(self):
        from app.core.framework_loader import get_all_risks, reset_framework_cache

        reset_framework_cache()
        assert len(get_all_risks()) == 50

    def test_env_path_loads_only_that_directory(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core.framework_loader import get_all_frameworks, reset_framework_cache

        (tmp_path / "tiny.yml").write_text(_minimal_framework_yaml("tiny"))
        monkeypatch.setenv("FRAMEWORKS_CONFIG_PATH", str(tmp_path))
        reset_framework_cache()
        try:
            frameworks = get_all_frameworks()
            assert len(frameworks) == 1
            assert frameworks[0].id == "tiny"
        finally:
            monkeypatch.delenv("FRAMEWORKS_CONFIG_PATH", raising=False)
            reset_framework_cache()

    def test_duplicate_risk_code_raises_value_error(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core.framework_loader import load_framework_manifest, reset_framework_cache

        (tmp_path / "tiny.yml").write_text(_minimal_framework_yaml("tiny", duplicate_code=True))
        monkeypatch.setenv("FRAMEWORKS_CONFIG_PATH", str(tmp_path))
        reset_framework_cache()
        try:
            with pytest.raises(ValueError, match="tiny.yml"):
                load_framework_manifest()
        finally:
            monkeypatch.delenv("FRAMEWORKS_CONFIG_PATH", raising=False)
            reset_framework_cache()

    def test_missing_prose_origin_raises_value_error(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        from app.core.framework_loader import load_framework_manifest, reset_framework_cache

        (tmp_path / "tiny.yml").write_text(_minimal_framework_yaml("tiny", prose_origin=None))
        monkeypatch.setenv("FRAMEWORKS_CONFIG_PATH", str(tmp_path))
        reset_framework_cache()
        try:
            with pytest.raises(ValueError, match="prose_origin"):
                load_framework_manifest()
        finally:
            monkeypatch.delenv("FRAMEWORKS_CONFIG_PATH", raising=False)
            reset_framework_cache()
