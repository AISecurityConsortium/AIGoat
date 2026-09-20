from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RagTraceIn(BaseModel):
    query: str
    rewritten_query: str | None = None
    top_k: int | None = None
    hybrid: bool | None = None
    defense_level: int | None = None

    model_config = ConfigDict(from_attributes=True)


class RagTraceCandidateOut(BaseModel):
    chunk_id: str | None = None
    entry_id: int | None = None
    title: str = ""
    content: str = ""
    dense_score: float | None = None
    bm25_score: float | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None
    is_user_injected: bool = False
    trust_tier: str = "user"
    included_in_context: bool = True
    truncated_by_budget: bool = False
    excluded_by_control: str | None = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class RagTraceOut(BaseModel):
    query: str
    rewritten_query: str
    top_k: int
    candidates: list[dict[str, Any]]
    token_budget: dict[str, int]
    controls_applied: list[str]
    citations: list[dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RagStatsOut(BaseModel):
    db_documents: int
    indexed_chunks: int
    collection_count: int
    in_sync: bool
    last_sync_at: str | None = None
    top_k: int

    model_config = ConfigDict(from_attributes=True, extra="allow")


class CitationOut(BaseModel):
    chunk_id: str | None = None
    title: str = ""
    quote: str = ""
    entry_id: int | None = None
    verified: bool = True

    model_config = ConfigDict(from_attributes=True)
