"""Reads an uploaded PDF the way a naive ingestion pipeline does, and shows what a person would see.

``pypdf`` returns every text run in the content stream, including runs painted white, set to the
invisible render mode, or shrunk to a speck. The analyser walks the same stream and labels each
run, so the lab can show the document a human reads next to the text the pipeline extracts.
Nothing in the file is executed. Only the content stream's text and colour operators are read.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any

from pypdf import PdfReader
from pypdf.errors import PyPdfError
from pypdf.generic import ContentStream

from app.labs.killchain.constants import MAX_PDF_PAGES, MAX_UPLOAD_BYTES

WHITE_THRESHOLD = 0.97
TINY_FONT = 2.0
MAX_SPANS = 400
MAX_SPAN_CHARS = 2000


class PdfRejected(ValueError):
    """The upload is not a PDF this lab will read. The message is safe to show the learner."""


@dataclass
class Span:
    text: str
    page: int
    hidden: bool
    reason: str = ""
    color: str = "#000000"
    size: float = 12.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "page": self.page,
            "hidden": self.hidden,
            "reason": self.reason,
            "color": self.color,
            "size": self.size,
        }


@dataclass
class PdfAnalysis:
    pages: int
    spans: list[Span] = field(default_factory=list)
    full_text: str = ""

    @property
    def visible_text(self) -> str:
        return "\n".join(span.text for span in self.spans if not span.hidden)

    @property
    def hidden_text(self) -> str:
        return "\n".join(span.text for span in self.spans if span.hidden)


def validate_upload(filename: str, content_type: str, data: bytes) -> str:
    """Return a clean display filename or raise ``PdfRejected``. Checked before any parsing."""
    name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    name = "".join(ch for ch in name if ch.isprintable() and ch not in '<>:"|?*')[:100]
    if not name or not name.lower().endswith(".pdf"):
        raise PdfRejected("Only .pdf attachments are accepted.")
    if content_type and content_type.split(";")[0].strip().lower() not in {"application/pdf", "application/x-pdf"}:
        raise PdfRejected("The attachment must be sent as application/pdf.")
    if not data:
        raise PdfRejected("The attachment is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise PdfRejected(f"The attachment is larger than {MAX_UPLOAD_BYTES // 1024} KB.")
    if not data.lstrip()[:5] == b"%PDF-":
        raise PdfRejected("The file does not start with a PDF header.")
    return name


def _hex(rgb: tuple[float, float, float]) -> str:
    r, g, b = (max(0, min(255, round(channel * 255))) for channel in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fill(operator: bytes, operands: list[Any], current: tuple[float, float, float]) -> tuple[float, float, float]:
    values = [_number(item, -1.0) for item in operands]
    if any(v < 0 for v in values):
        return current
    if operator in (b"g",) and len(values) == 1:
        return (values[0],) * 3
    if operator in (b"rg",) and len(values) == 3:
        return (values[0], values[1], values[2])
    if operator in (b"k",) and len(values) == 4:
        c, m, y, k = values
        return ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
    if operator in (b"sc", b"scn"):
        if len(values) == 1:
            return (values[0],) * 3
        if len(values) == 3:
            return (values[0], values[1], values[2])
        if len(values) == 4:
            c, m, y, k = values
            return ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
    return current


def _text_of(operand: Any) -> str:
    if isinstance(operand, bytes):
        return operand.decode("latin-1", errors="replace")
    return str(operand)


def _shown_text(operator: bytes, operands: list[Any]) -> str:
    if operator == b"Tj" and operands:
        return _text_of(operands[0])
    if operator in (b"'", b'"') and operands:
        return _text_of(operands[-1])
    if operator == b"TJ" and operands and isinstance(operands[0], list):
        parts: list[str] = []
        for item in operands[0]:
            if isinstance(item, (int, float)) and not isinstance(item, bool):
                if item < -200:
                    parts.append(" ")
            else:
                parts.append(_text_of(item))
        return "".join(parts)
    return ""


def _classify(fill: tuple[float, float, float], size: float, render: int) -> tuple[bool, str]:
    reasons: list[str] = []
    if render == 3:
        reasons.append("invisible text render mode")
    if all(channel >= WHITE_THRESHOLD for channel in fill):
        reasons.append("white text on a white page")
    if 0 < size < TINY_FONT:
        reasons.append(f"font size {size:g} pt")
    return (bool(reasons), "; ".join(reasons))


def analyze_pdf(data: bytes) -> PdfAnalysis:
    """Parse ``data`` and label each text run. Raises ``PdfRejected`` for unreadable input."""
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise PdfRejected("Encrypted PDFs are not accepted.")
        page_count = len(reader.pages)
        if page_count == 0:
            raise PdfRejected("The PDF has no pages.")
        if page_count > MAX_PDF_PAGES:
            raise PdfRejected(f"The PDF has more than {MAX_PDF_PAGES} pages.")
        spans: list[Span] = []
        extracted: list[str] = []
        for number, page in enumerate(reader.pages, start=1):
            extracted.append((page.extract_text() or "").strip())
            contents = page.get_contents()
            if contents is None:
                continue
            fill = (0.0, 0.0, 0.0)
            size = 12.0
            render = 0
            saved: list[tuple[tuple[float, float, float], float, int]] = []
            for operands, operator in ContentStream(contents, reader).operations:
                if operator == b"q":
                    saved.append((fill, size, render))
                elif operator == b"Q" and saved:
                    fill, size, render = saved.pop()
                elif operator in (b"g", b"rg", b"k", b"sc", b"scn"):
                    fill = _fill(operator, list(operands), fill)
                elif operator == b"Tf" and len(operands) >= 2:
                    size = _number(operands[1], size)
                elif operator == b"Tr" and operands:
                    render = int(_number(operands[0], 0))
                elif operator in (b"Tj", b"TJ", b"'", b'"'):
                    text = _shown_text(operator, list(operands)).strip()
                    if not text:
                        continue
                    hidden, reason = _classify(fill, size, render)
                    spans.append(Span(
                        text=text[:MAX_SPAN_CHARS], page=number, hidden=hidden, reason=reason,
                        color=_hex(fill), size=round(size, 2),
                    ))
                    if len(spans) >= MAX_SPANS:
                        break
        return PdfAnalysis(pages=page_count, spans=spans, full_text="\n\n".join(t for t in extracted if t))
    except PdfRejected:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, IndexError, RecursionError, OSError) as exc:
        raise PdfRejected("The file could not be read as a PDF.") from exc
