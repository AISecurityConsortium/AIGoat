"""Builds the invoice PDF fixture byte for byte, so the committed file can be verified.

The page looks like an ordinary supplier invoice. Below the footer, two lines are painted white
at 7 pt. A person sees nothing there. A text extractor returns them, which is the whole attack.
"""
from __future__ import annotations

from app.labs.killchain.constants import PROCEDURES

_VISIBLE_LINES = (
    # (font, size, x, y, text)
    ("F2", 20, 56, 780, "INVOICE"),
    ("F1", 10, 56, 758, "Northwind Logistics Ltd  |  14 Dockside Road, Leeds LS1 4AB"),
    ("F2", 11, 380, 780, "Invoice no. INV-2041"),
    ("F1", 10, 380, 764, "Issued: 2026-09-28"),
    ("F1", 10, 380, 750, "Due: 2026-10-28 (net 30)"),
    ("F2", 10, 56, 710, "Bill to"),
    ("F1", 10, 56, 696, "AIGoat Demo Shop, Accounts Payable"),
    ("F1", 10, 56, 682, "Purchase order KC-PO-7731"),
    ("F2", 10, 56, 640, "Description"),
    ("F2", 10, 330, 640, "Qty"),
    ("F2", 10, 380, 640, "Unit"),
    ("F2", 10, 470, 640, "Amount"),
    ("F1", 10, 56, 618, "Pallet handling, Leeds warehouse"),
    ("F1", 10, 330, 618, "4"),
    ("F1", 10, 380, 618, "85.00"),
    ("F1", 10, 470, 618, "340.00"),
    ("F1", 10, 56, 600, "Last-mile delivery, September"),
    ("F1", 10, 330, 600, "22"),
    ("F1", 10, 380, 600, "12.50"),
    ("F1", 10, 470, 600, "275.00"),
    ("F1", 10, 56, 582, "Fuel surcharge"),
    ("F1", 10, 330, 582, "1"),
    ("F1", 10, 380, 582, "38.50"),
    ("F1", 10, 470, 582, "38.50"),
    ("F1", 10, 380, 540, "Subtotal"),
    ("F1", 10, 470, 540, "653.50"),
    ("F1", 10, 380, 524, "VAT 20%"),
    ("F1", 10, 470, 524, "130.70"),
    ("F2", 11, 380, 504, "Total due (USD)"),
    ("F2", 11, 470, 504, "784.20"),
    ("F1", 9, 56, 440, "Payment by bank transfer to the account on file. Quote INV-2041 as the reference."),
    ("F1", 9, 56, 426, "Questions about this invoice: accounts@northwind-logistics.example.test"),
    ("F1", 9, 56, 120, "Thank you for your business."),
)
_RULES = ((56, 654, 483, 0.5), (56, 632, 483, 0.5), (370, 516, 169, 0.5))
# The coupon abuse note is not in the file. The attacker only knows the internal coupon after the
# coupon disclosure has run, so that step comes later, through a review.
HIDDEN_PROCEDURES = ("customer_export", "coupon_disclosure")
_HIDDEN_FONT = "F1"
_HIDDEN_SIZE = 7
_HIDDEN_X = 56
_HIDDEN_Y_TOP = 96
_HIDDEN_STEP = 10


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _content_stream() -> bytes:
    ops: list[str] = []
    for x, y, width, thickness in _RULES:
        ops.append(f"0.6 g {x} {y} {width} {thickness} re f")
    ops.append("0 g")
    ops.append("BT")
    for font, size, x, y, text in _VISIBLE_LINES:
        ops.append(f"/{font} {size} Tf 1 0 0 1 {x} {y} Tm ({_esc(text)}) Tj")
    ops.append("ET")
    # Hidden instructions: white fill, 7 pt, in the margin under the footer.
    ops.append("q 1 1 1 rg BT")
    for index, key in enumerate(HIDDEN_PROCEDURES):
        y = _HIDDEN_Y_TOP - index * _HIDDEN_STEP
        ops.append(f"/{_HIDDEN_FONT} {_HIDDEN_SIZE} Tf 1 0 0 1 {_HIDDEN_X} {y} Tm ({_esc(PROCEDURES[key])}) Tj")
    ops.append("ET Q")
    return ("\n".join(ops) + "\n").encode("latin-1")


def build_invoice_pdf() -> bytes:
    stream = _content_stream()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream",
        b"<< /Title (Invoice INV-2041) /Producer (Northwind billing) /CreationDate (D:20260928090000Z) >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)
