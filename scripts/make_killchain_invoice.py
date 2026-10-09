"""Regenerate the Agentic Kill Chain invoice fixture. Run from the repo root: python scripts/make_killchain_invoice.py"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.labs.killchain.constants import FIXTURE_DIR, INVOICE_FIXTURE  # noqa: E402
from app.labs.killchain.invoice import build_invoice_pdf  # noqa: E402


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    data = build_invoice_pdf()
    INVOICE_FIXTURE.write_bytes(data)
    print(f"wrote {INVOICE_FIXTURE} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
