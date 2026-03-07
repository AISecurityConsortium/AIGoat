"""Tests for config.yml validation (fail-fast on invalid settings)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import AppConfig, OllamaConfig, RagConfig


class TestAppConfig:
    def test_empty_secret_key_rejected(self):
        with pytest.raises(ValidationError, match="secret_key"):
            AppConfig(secret_key="")

    def test_whitespace_secret_key_rejected(self):
        with pytest.raises(ValidationError, match="secret_key"):
            AppConfig(secret_key="   ")

    def test_valid_secret_key_accepted(self):
        cfg = AppConfig(secret_key="my-secret")
        assert cfg.secret_key == "my-secret"


class TestOllamaConfig:
    def test_invalid_base_url_rejected(self):
        with pytest.raises(ValidationError, match="base_url"):
            OllamaConfig(base_url="ftp://localhost:11434")

    def test_no_scheme_rejected(self):
        with pytest.raises(ValidationError, match="base_url"):
            OllamaConfig(base_url="localhost:11434")

    def test_http_accepted(self):
        cfg = OllamaConfig(base_url="http://localhost:11434")
        assert cfg.base_url == "http://localhost:11434"

    def test_https_accepted(self):
        cfg = OllamaConfig(base_url="https://ollama.example.com")
        assert cfg.base_url == "https://ollama.example.com"


class TestRagConfig:
    def test_zero_max_context_tokens_rejected(self):
        with pytest.raises(ValidationError, match="max_context_tokens"):
            RagConfig(max_context_tokens=0)

    def test_negative_max_context_tokens_rejected(self):
        with pytest.raises(ValidationError, match="max_context_tokens"):
            RagConfig(max_context_tokens=-100)

    def test_positive_max_context_tokens_accepted(self):
        cfg = RagConfig(max_context_tokens=2000)
        assert cfg.max_context_tokens == 2000
