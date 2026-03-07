from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

import yaml
from pydantic import BaseModel, Field, field_validator


class AppConfig(BaseModel):
    name: str = "AI Goat"
    debug: bool = False
    secret_key: str = ""
    allowed_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    media_dir: str = "./media"

    @field_validator("secret_key")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("app.secret_key must be a non-empty string")
        return v


class DatabaseConfig(BaseModel):
    url: str = "sqlite+aiosqlite:///./aigoat.db"


class OllamaConfig(BaseModel):
    base_url: str = "http://localhost:11434"
    model: str = "mistral"
    timeout: int = 60

    @field_validator("base_url")
    @classmethod
    def base_url_must_be_http(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("ollama.base_url must start with http:// or https://")
        return v


class DefenseConfig(BaseModel):
    level: int = 0
    l1_confidence_threshold: float = 0.6
    l2_confidence_threshold: float = 0.3


class RagConfig(BaseModel):
    enabled: bool = True
    embedding_model: str = "all-MiniLM-L6-v2"
    chroma_path: str = "./chroma_db"
    top_k: int = 5
    chunk_size: int = 512
    max_context_tokens: int = 1500

    @field_validator("max_context_tokens")
    @classmethod
    def max_context_tokens_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("rag.max_context_tokens must be > 0")
        return v


class ChatConfig(BaseModel):
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    max_tokens: int = 500


class FeaturesConfig(BaseModel):
    admin_dashboard: bool = True
    coupon_system: bool = True
    knowledge_base: bool = True


class Settings(BaseModel):
    app: AppConfig = Field(default_factory=AppConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    ollama: OllamaConfig = Field(default_factory=OllamaConfig)
    defense: DefenseConfig = Field(default_factory=DefenseConfig)
    rag: RagConfig = Field(default_factory=RagConfig)
    chat: ChatConfig = Field(default_factory=ChatConfig)
    features: FeaturesConfig = Field(default_factory=FeaturesConfig)


def load_config(path: str | Path | None = None) -> Settings:
    if path is None:
        path = os.environ.get("CONFIG_PATH", "config/config.yml")
    path = Path(path)
    if not path.is_absolute():
        base = Path(__file__).resolve().parent.parent.parent
        path = base / path
    with open(path) as f:
        data = yaml.safe_load(f)
    settings = Settings(**data)
    ollama_url = os.environ.get("OLLAMA_BASE_URL")
    if ollama_url:
        settings.ollama.base_url = ollama_url
    return settings


@lru_cache
def get_settings() -> Settings:
    return load_config()
