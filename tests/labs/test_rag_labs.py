"""Contract coverage for the nine rag.kb labs in architecture §2.5."""
from __future__ import annotations

from app.core.lab_loader import get_lab_by_id

_RAG_LABS = (
    "llm08-1",
    "llm02-3",
    "llm01-4",
    "llm08-2",
    "llm08-3",
    "llm08-4",
    "llm02-4",
    "llm08-5",
    "llm08-6",
)


def test_nine_rag_kb_labs_are_active():
    for lab_id in _RAG_LABS:
        lab = get_lab_by_id(lab_id)
        assert lab is not None, lab_id
        assert lab.surface == "rag.kb", lab_id
        assert lab.status == "active", lab_id
        assert set(lab.expected_by_level) == {0, 1, 2}, lab_id
        assert lab.example_payloads, lab_id


def test_acl_lab_teaches_l0_leak_and_l2_block():
    lab = get_lab_by_id("llm02-4")
    assert lab is not None
    assert "not yet authorization-aware" in lab.expected_by_level[1]
    assert "retrieval.acl" in lab.expected_by_level[2]
