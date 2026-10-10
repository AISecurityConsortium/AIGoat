"""RAG page: the lab switcher and hub groups stay in step with the rag.kb labs, and the page is named RAG."""
from __future__ import annotations

import re
from pathlib import Path

from app.core.lab_loader import get_all_labs

ROOT = Path(__file__).resolve().parent.parent
TEACHING = ROOT / "frontend" / "src" / "utils" / "labTeaching.js"
HERO = ROOT / "frontend" / "src" / "components" / "rag" / "RagHero.jsx"
HEADER = ROOT / "frontend" / "src" / "components" / "Header.js"


def _rag_nav_ids() -> list[str]:
    text = TEACHING.read_text(encoding="utf-8")
    block = text[text.index("export const RAG_NAV_GROUPS"):text.index("export const RAG_ORDER")]
    ids: list[str] = []
    for group in re.findall(r"labs: \[([^\]]*)\]", block):
        ids.extend(re.findall(r"'([^']+)'", group))
    return ids


def test_rag_switcher_groups_cover_every_rag_lab_once():
    ids = _rag_nav_ids()
    expected = {lab.id for lab in get_all_labs() if lab.surface == "rag.kb"}
    assert len(ids) == len(set(ids))
    assert set(ids) == expected
    assert len(expected) >= 9


def test_rag_page_title_and_description_are_the_requested_copy():
    hero = HERO.read_text(encoding="utf-8")
    assert "RAG (Retrieval-Augmented Generation) Knowledge base attack surface for AI Goat Shop" in hero
    assert 'title="RAG"' in hero


def test_nav_labels_the_page_rag():
    header = HEADER.read_text(encoding="utf-8")
    assert "{ to: '/knowledge-base', label: 'RAG' }" in header
    assert 'to="/knowledge-base" icon={<LibraryBooksIcon />} label="RAG"' in header
