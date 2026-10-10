"""Serve the Agentic Top 10 lab writeups (docs/agenttop10) through the API.

The writeups are plain markdown files. Slugs are derived from the file names and
validated against a directory listing, so a request can never read a file outside
the writeup folder.
"""
from __future__ import annotations

import os

_DOCS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "docs", "agenttop10")
)


def _title(markdown: str, fallback: str) -> str:
    """The first level-one heading, or the slug if there is none."""
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def _slug_paths() -> dict[str, str]:
    """Map slug -> absolute path for every markdown writeup. No traversal possible."""
    out: dict[str, str] = {}
    if not os.path.isdir(_DOCS_DIR):
        return out
    for name in sorted(os.listdir(_DOCS_DIR)):
        if name.endswith(".md") and os.path.isfile(os.path.join(_DOCS_DIR, name)):
            out[name[:-3]] = os.path.join(_DOCS_DIR, name)
    return out


def list_writeups() -> list[dict]:
    """Slug and title for every available writeup, sorted by slug."""
    items: list[dict] = []
    for slug, path in _slug_paths().items():
        with open(path, "r", encoding="utf-8") as handle:
            markdown = handle.read()
        items.append({"slug": slug, "title": _title(markdown, slug)})
    return items


def get_writeup(slug: str) -> dict | None:
    """Full markdown for one writeup, or None when the slug is unknown."""
    path = _slug_paths().get(slug)
    if path is None:
        return None
    with open(path, "r", encoding="utf-8") as handle:
        markdown = handle.read()
    return {"slug": slug, "title": _title(markdown, slug), "markdown": markdown}
