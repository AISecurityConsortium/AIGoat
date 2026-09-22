"""Guard against U+2014 em dashes in learner-visible trees (T076)."""
from __future__ import annotations

from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_EM = "\u2014"
_TREES = (
    _ROOT / "config" / "labs",
    _ROOT / "config" / "frameworks",
    _ROOT / "prompts",
    _ROOT / "frontend" / "src",
    _ROOT / "docs",
    _ROOT / "media" / "diagrams",
)
_FILES = (_ROOT / "README.md",)
_TEXT_SUFFIXES = {".yml", ".yaml", ".md", ".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html", ".svg"}
_EXCLUDE_NAMES = {"LICENSE"}


def _iter_paths() -> list[Path]:
    out: list[Path] = []
    for tree in _TREES:
        if not tree.exists():
            continue
        for path in tree.rglob("*"):
            if not path.is_file() or path.name in _EXCLUDE_NAMES:
                continue
            if path.suffix in _TEXT_SUFFIXES:
                out.append(path)
    for path in _FILES:
        if path.is_file():
            out.append(path)
    return out


def test_no_em_dash_in_learner_visible_trees():
    hits: list[str] = []
    for path in _iter_paths():
        text = path.read_text(encoding="utf-8")
        if _EM not in text:
            continue
        rel = path.relative_to(_ROOT)
        for lineno, line in enumerate(text.splitlines(), 1):
            if _EM in line:
                hits.append(f"{rel}:{lineno}: {line.strip()}")
    assert not hits, "U+2014 em dash is banned in learner-visible content:\n" + "\n".join(hits)
