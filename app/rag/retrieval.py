from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.token_utils import estimate_tokens
from app.rag.chunking import semantic_chunk
from app.rag.embeddings import get_embedding_service
from app.rag.hybrid import Bm25Index
from app.rag.rrf import rrf_scores


def entry_content_hash(title: str, content: str) -> str:
    payload = f"{title}\n{content}".encode()
    return hashlib.sha256(payload).hexdigest()


def citations_from_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build citations whose quote is an exact substring of the chunk."""
    out: list[dict[str, Any]] = []
    for cand in candidates:
        if not cand.get("included_in_context"):
            continue
        content = cand.get("content") or ""
        quote = content[:240]
        if quote and quote not in content:
            continue
        out.append({
            "chunk_id": cand.get("chunk_id"),
            "title": cand.get("title") or "",
            "quote": quote,
            "entry_id": cand.get("entry_id"),
            "verified": quote in content,
        })
    return out


def apply_token_budget(candidates: list[dict[str, Any]], max_tokens: int) -> dict[str, int]:
    """Mark included/truncated flags. Dropped rows stay in the list (trace UI)."""
    used = 0
    dropped = 0
    kept_any = False
    for cand in candidates:
        if cand.get("excluded_by_control"):
            cand["included_in_context"] = False
            cand["truncated_by_budget"] = False
            continue
        cost = estimate_tokens(cand.get("content") or "")
        if used + cost > max_tokens and kept_any:
            cand["included_in_context"] = False
            cand["truncated_by_budget"] = True
            dropped += 1
            continue
        cand["included_in_context"] = True
        cand["truncated_by_budget"] = False
        used += cost
        kept_any = True
    return {"max": max_tokens, "used": used, "chunks_dropped": dropped}


def _chroma_meta(value: Any, default: str | int | float | bool = "") -> str | int | float | bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, str)):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _owner_for_chroma(owner_id: Any) -> int:
    if owner_id is None:
        return -1
    return int(owner_id)


def _owner_from_chroma(value: Any) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _chunk_ids_for_entry(entry_id: int, n_chunks: int) -> list[str]:
    return [f"{entry_id}_{idx}" for idx in range(n_chunks)]


def _optional_rerank(query_text: str, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """L2-style rerank. No-ops when config.reranker is null or FlashRank is absent."""
    spec = get_settings().rag.reranker
    if not spec or not candidates:
        return candidates
    try:
        from flashrank import Ranker, RerankRequest
    except ImportError:
        return candidates
    model_name = spec.split(":", 1)[-1] if ":" in spec else spec
    ranker = Ranker(model_name=model_name)
    passages = [
        {"id": i, "text": cand.get("content") or ""}
        for i, cand in enumerate(candidates)
    ]
    request = RerankRequest(query=query_text, passages=passages)
    ranked = ranker.rerank(request)
    by_id = {int(item["id"]): float(item.get("score") or 0.0) for item in ranked}
    for i, cand in enumerate(candidates):
        cand["rerank_score"] = by_id.get(i)
    return sorted(candidates, key=lambda c: c.get("rerank_score") or 0.0, reverse=True)


class RetrievalService:
    def __init__(
        self,
        chroma_path: str | None = None,
        collection_name: str = "product_knowledge",
    ) -> None:
        settings = get_settings()
        self._chroma_path = chroma_path or settings.rag.chroma_path
        self._collection_name = collection_name
        self._client = None
        self._collection = None
        self._bm25 = Bm25Index()
        self._bm25_ready = False

    def _get_collection(self):
        if self._collection is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            self._client = chromadb.PersistentClient(
                path=self._chroma_path,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def add_documents(self, docs: list[dict]) -> None:
        if not docs:
            return
        coll = self._get_collection()
        embedding_svc = get_embedding_service()
        ids: list[str] = []
        texts: list[str] = []
        metadatas: list[dict] = []
        for doc in docs:
            doc_id = doc.get("id") or str(hash(doc.get("content", "")))
            content = doc.get("content", "")
            metadata = {k: v for k, v in doc.items() if k not in ("id", "content") and v is not None}
            if isinstance(metadata.get("metadata"), dict):
                metadata.update(metadata.pop("metadata", {}))
            cleaned = {k: _chroma_meta(v) for k, v in metadata.items()}
            ids.append(str(doc_id))
            texts.append(content)
            metadatas.append(cleaned)
        embeddings = embedding_svc.embed_batch(texts)
        coll.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
        self._bm25_ready = False

    def query(self, query_text: str, top_k: int = 5, where: dict | None = None) -> list[dict]:
        """Dense-only query. Shape stays {content, metadata, distance} for chat callers."""
        hits = self._dense_query(query_text, top_k=top_k, where=where)
        out: list[dict] = []
        for hit in hits:
            out.append({
                "content": hit["content"],
                "metadata": hit["metadata"],
                "distance": hit["distance"],
                "id": hit["chunk_id"],
                "is_user_injected": hit["is_user_injected"],
                "trust_tier": hit["trust_tier"],
                "owner_id": hit["owner_id"],
            })
        return out

    def count(self) -> int:
        try:
            return self._get_collection().count()
        except Exception:
            return 0

    def delete_collection(self) -> None:
        if self._client is not None:
            try:
                self._client.delete_collection(self._collection_name)
            except Exception:
                pass
            self._collection = None
        self._bm25 = Bm25Index()
        self._bm25_ready = False

    async def query_async(
        self,
        query_text: str,
        top_k: int = 5,
        where: dict | None = None,
    ) -> list[dict]:
        return await asyncio.to_thread(self.query, query_text, top_k, where)

    def _entry_chunks(self, ent: Any) -> list[str]:
        content = getattr(ent, "content", str(ent)) or ""
        chunks = semantic_chunk(content, max_chunk_size=get_settings().rag.chunk_size)
        if not chunks:
            return [content or " "]
        return chunks

    def _doc_from_entry(self, ent: Any, chunk: str, chunk_index: int, chunk_id: str) -> dict:
        owner = getattr(ent, "owner_id", None)
        valid_until = getattr(ent, "valid_until", None)
        return {
            "id": chunk_id,
            "content": chunk,
            "title": getattr(ent, "title", "") or "",
            "category": getattr(ent, "category", "") or "",
            "product_id": _chroma_meta(getattr(ent, "product_id", None), default=0),
            "entry_id": int(getattr(ent, "id", 0) or 0),
            "chunk_index": chunk_index,
            "is_user_injected": bool(getattr(ent, "is_user_injected", False)),
            "trust_tier": getattr(ent, "trust_tier", None) or "user",
            "owner_id": _owner_for_chroma(owner),
            "version": int(getattr(ent, "version", 1) or 1),
            "is_latest": bool(getattr(ent, "is_latest", True)),
            "valid_until": _chroma_meta(valid_until, default=""),
        }

    def sync(self, entries: list, *, rebuild: bool = False) -> None:
        """Incremental upsert. ``rebuild=True`` is the full-rebuild escape hatch."""
        if rebuild:
            self.delete_collection()

        coll = self._get_collection()
        existing = coll.get(include=[])
        existing_ids = set(existing.get("ids") or [])

        wanted_ids: set[str] = set()
        docs: list[dict] = []
        stale_ids: list[str] = []

        for ent in entries:
            entry_id = int(getattr(ent, "id", 0) or 0)
            chunks = self._entry_chunks(ent)
            chunk_ids = _chunk_ids_for_entry(entry_id, len(chunks))
            wanted_ids.update(chunk_ids)
            title = getattr(ent, "title", "") or ""
            content = getattr(ent, "content", "") or ""
            digest = entry_content_hash(title, content)
            stored_hash = getattr(ent, "content_hash", None)
            stored_embed = getattr(ent, "embedding_id", None)
            missing = any(cid not in existing_ids for cid in chunk_ids)
            stale = rebuild or stored_hash != digest or stored_embed != chunk_ids[0] or missing
            if stale:
                prefix = f"{entry_id}_"
                stale_ids.extend(i for i in existing_ids if i.startswith(prefix))
                for idx, chunk in enumerate(chunks):
                    docs.append(self._doc_from_entry(ent, chunk, idx, chunk_ids[idx]))
                if hasattr(ent, "embedding_id"):
                    ent.embedding_id = chunk_ids[0]
                if hasattr(ent, "chunk_index"):
                    ent.chunk_index = len(chunks)
                if hasattr(ent, "content_hash"):
                    ent.content_hash = digest
                if hasattr(ent, "metadata_json") and isinstance(getattr(ent, "metadata_json"), dict):
                    meta = dict(ent.metadata_json or {})
                    meta["indexed_at"] = datetime.now(timezone.utc).isoformat()
                    ent.metadata_json = meta

        orphans = [i for i in existing_ids if i not in wanted_ids]
        to_delete = list({*stale_ids, *orphans})
        if to_delete:
            try:
                coll.delete(ids=to_delete)
            except Exception:
                pass

        self.add_documents(docs)
        self._rebuild_bm25()

    async def sync_async(self, entries: list, *, rebuild: bool = False) -> None:
        await asyncio.to_thread(self.sync, entries, rebuild=rebuild)

    def _rebuild_bm25(self) -> None:
        coll = self._get_collection()
        data = coll.get(include=["documents"])
        ids = list(data.get("ids") or [])
        texts = [d or "" for d in (data.get("documents") or [])]
        self._bm25.rebuild(ids, texts)
        self._bm25_ready = True

    def _ensure_bm25(self) -> None:
        if not self._bm25_ready:
            self._rebuild_bm25()

    def _hit_from_chroma(
        self,
        chunk_id: str,
        content: str,
        meta: dict,
        distance: float | None,
    ) -> dict[str, Any]:
        dense_score = None
        if distance is not None:
            dense_score = 1.0 - float(distance)
        return {
            "chunk_id": chunk_id,
            "entry_id": int(meta.get("entry_id") or 0),
            "title": meta.get("title") or "",
            "content": content,
            "dense_score": dense_score,
            "bm25_score": None,
            "rrf_score": None,
            "rerank_score": None,
            "is_user_injected": bool(meta.get("is_user_injected")),
            "trust_tier": meta.get("trust_tier") or "user",
            "owner_id": _owner_from_chroma(meta.get("owner_id")),
            "version": int(meta.get("version") or 1),
            "is_latest": bool(meta.get("is_latest", True)),
            "included_in_context": True,
            "truncated_by_budget": False,
            "excluded_by_control": None,
            "metadata": meta,
            "distance": distance,
        }

    def _dense_query(
        self,
        query_text: str,
        top_k: int,
        where: dict | None = None,
    ) -> list[dict[str, Any]]:
        coll = self._get_collection()
        embedding_svc = get_embedding_service()
        q_emb = embedding_svc.embed_text(query_text)
        available = coll.count()
        n = min(top_k, available)
        if n <= 0:
            return []
        kwargs: dict[str, Any] = {
            "query_embeddings": [q_emb],
            "n_results": n,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where
        result = coll.query(**kwargs)
        ids = (result.get("ids") or [[]])[0] or []
        docs = (result.get("documents") or [[]])[0] or []
        metadatas = (result.get("metadatas") or [[]])[0] or []
        distances = (result.get("distances") or [[]])[0] or []
        hits: list[dict[str, Any]] = []
        for i, chunk_id in enumerate(ids):
            content = docs[i] if i < len(docs) else ""
            meta = metadatas[i] if i < len(metadatas) else {}
            dist = distances[i] if i < len(distances) else None
            hits.append(self._hit_from_chroma(str(chunk_id), content or "", meta or {}, dist))
        return hits

    def _fetch_by_ids(self, chunk_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not chunk_ids:
            return {}
        coll = self._get_collection()
        data = coll.get(ids=chunk_ids, include=["documents", "metadatas"])
        ids = data.get("ids") or []
        docs = data.get("documents") or []
        metas = data.get("metadatas") or []
        out: dict[str, dict[str, Any]] = {}
        for i, chunk_id in enumerate(ids):
            content = docs[i] if i < len(docs) else ""
            meta = metas[i] if i < len(metas) else {}
            out[str(chunk_id)] = self._hit_from_chroma(str(chunk_id), content or "", meta or {}, None)
        return out

    def retrieve(
        self,
        query_text: str,
        *,
        top_k: int | None = None,
        hybrid: bool | None = None,
        where: dict | None = None,
        rerank: bool | None = None,
    ) -> list[dict[str, Any]]:
        settings = get_settings()
        if not settings.rag.enabled:
            return []
        k = top_k if top_k is not None else settings.rag.top_k
        use_hybrid = settings.rag.hybrid if hybrid is None else hybrid
        use_rerank = bool(settings.rag.reranker) if rerank is None else rerank
        pool = max(k * 4, k)

        dense_hits = self._dense_query(query_text, top_k=pool, where=where)
        by_id = {h["chunk_id"]: h for h in dense_hits}

        if use_hybrid:
            self._ensure_bm25()
            bm25_hits = self._bm25.query(query_text, top_k=pool)
            missing = [cid for cid, _ in bm25_hits if cid not in by_id]
            by_id.update(self._fetch_by_ids(missing))
            for cid, score in bm25_hits:
                if cid in by_id:
                    by_id[cid]["bm25_score"] = score
            dense_order = [h["chunk_id"] for h in dense_hits]
            bm25_order = [cid for cid, _ in bm25_hits]
            fused = rrf_scores([dense_order, bm25_order], k=settings.rag.rrf_k)
            for cid, score in fused.items():
                if cid in by_id:
                    by_id[cid]["rrf_score"] = score
            ordered_ids = sorted(
                (cid for cid in fused if cid in by_id),
                key=lambda cid: fused[cid],
                reverse=True,
            )
            candidates = [by_id[cid] for cid in ordered_ids]
        else:
            candidates = dense_hits

        if use_rerank:
            candidates = _optional_rerank(query_text, candidates)

        return candidates[:k]

    async def retrieve_async(self, query_text: str, **kwargs: Any) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self.retrieve, query_text, **kwargs)
