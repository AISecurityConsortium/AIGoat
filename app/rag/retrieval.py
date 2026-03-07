from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.rag.chunking import semantic_chunk
from app.rag.embeddings import get_embedding_service


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
            ids.append(str(doc_id))
            texts.append(content)
            metadatas.append(metadata)
        embeddings = embedding_svc.embed_batch(texts)
        coll.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)

    def query(self, query_text: str, top_k: int = 5) -> list[dict]:
        coll = self._get_collection()
        embedding_svc = get_embedding_service()
        q_emb = embedding_svc.embed_text(query_text)
        top_k = min(top_k, coll.count())
        if top_k <= 0:
            return []
        result = coll.query(
            query_embeddings=[q_emb],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        out: list[dict] = []
        docs = result.get("documents", [[]])[0] or []
        metadatas = result.get("metadatas", [[]])[0] or []
        distances = result.get("distances", [[]])[0] or []
        for i, doc in enumerate(docs):
            meta = metadatas[i] if i < len(metadatas) else {}
            dist = distances[i] if i < len(distances) else None
            out.append({
                "content": doc,
                "metadata": meta,
                "distance": dist,
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

    async def query_async(self, query_text: str, top_k: int = 5) -> list[dict]:
        """Non-blocking wrapper around the synchronous ChromaDB query."""
        return await asyncio.to_thread(self.query, query_text, top_k)

    def sync(self, entries: list) -> None:
        self.delete_collection()
        self._collection = None
        docs: list[dict] = []
        for ent in entries:
            content = getattr(ent, "content", str(ent))
            doc = {
                "id": f"{getattr(ent, 'id', id(ent))}_{getattr(ent, 'chunk_index', 0)}",
                "content": content,
                "title": getattr(ent, "title", ""),
                "category": getattr(ent, "category", ""),
                "product_id": getattr(ent, "product_id", None),
            }
            chunks = semantic_chunk(content, max_chunk_size=get_settings().rag.chunk_size)
            if not chunks:
                docs.append({**doc, "content": content or " "})
            else:
                for idx, chunk in enumerate(chunks):
                    docs.append({
                        **doc,
                        "id": f"{doc['id']}_c{idx}",
                        "content": chunk,
                        "chunk_index": idx,
                    })
        self.add_documents(docs)

    async def sync_async(self, entries: list) -> None:
        """Non-blocking wrapper around the synchronous sync method."""
        await asyncio.to_thread(self.sync, entries)
