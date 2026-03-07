from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.coupon import Coupon
    from app.models.order import Order
    from app.models.product import Product
    from app.models.user import User

PROMPT_CACHE_TTL = 300
_prompt_cache: dict[tuple, tuple[str, float]] = {}


_lab_map_cache: dict[str, str] = {}
_lab_map_ts: float = 0.0


def _get_lab_prompt_map() -> dict[str, str]:
    """Derive and cache the lab_id -> prompt_file mapping from labs.yml."""
    global _lab_map_cache, _lab_map_ts
    now = time.time()
    if _lab_map_cache and (now - _lab_map_ts) < PROMPT_CACHE_TTL:
        return _lab_map_cache
    from app.core.lab_loader import get_all_labs
    _lab_map_cache = {
        lab.id: lab.prompt_file
        for lab in get_all_labs()
        if lab.prompt_file
    }
    _lab_map_ts = now
    return _lab_map_cache


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def load_prompt(level: int, name: str = "cracky") -> str:
    cache_key = ("level", level, name)
    now = time.time()
    if cache_key in _prompt_cache:
        content, ts = _prompt_cache[cache_key]
        if now - ts < PROMPT_CACHE_TTL:
            return content
    path = _project_root() / "prompts" / f"level{level}" / f"{name}.md"
    content = path.read_text() if path.exists() else ""
    _prompt_cache[cache_key] = (content, now)
    return content


def load_lab_prompt(lab_id: str) -> str | None:
    """Load a lab-specific prompt that fully replaces the base system prompt.

    Returns None if the lab_id has no mapped prompt file.
    """
    prompt_name = _get_lab_prompt_map().get(lab_id)
    if not prompt_name:
        return None
    cache_key = ("lab", lab_id)
    now = time.time()
    if cache_key in _prompt_cache:
        content, ts = _prompt_cache[cache_key]
        if now - ts < PROMPT_CACHE_TTL:
            return content
    path = _project_root() / "prompts" / "labs" / f"{prompt_name}.md"
    if not path.exists():
        return None
    content = path.read_text()
    _prompt_cache[cache_key] = (content, now)
    return content


def load_rag_prompt() -> str:
    """Load the RAG product assistant prompt from file."""
    cache_key = ("rag",)
    now = time.time()
    if cache_key in _prompt_cache:
        content, ts = _prompt_cache[cache_key]
        if now - ts < PROMPT_CACHE_TTL:
            return content
    path = _project_root() / "prompts" / "rag" / "product_assistant.md"
    content = path.read_text() if path.exists() else ""
    _prompt_cache[cache_key] = (content, now)
    return content


def _mask_card(card: str | None) -> str:
    if not card or len(card) < 4:
        return "****"
    return "*" * (len(card) - 4) + card[-4:]


def build_sensitive_context(
    user: "User | None",
    orders: list["Order"],
    products: list["Product"],
    coupons: list["Coupon"],
    defense_level: int,
) -> str:
    if defense_level == 2:
        lines: list[str] = []
        for p in products:
            lines.append(
                f"- {p.name}: {p.description} | price: {p.price} | specs: {p.specifications}"
            )
        return "\n".join(lines) if lines else "No products in catalog."

    if defense_level == 1:
        lines = []
        if user:
            lines.append(f"Current user: {user.username}, email: {user.email}")
            if user.profile and user.profile.card_number:
                lines.append(
                    f"Card (masked): {_mask_card(user.profile.card_number)}"
                )
        for o in orders:
            if o.user_id != (user.id if user else None):
                continue
            lines.append(
                f"Order {o.id}: total={o.total_amount}, status={o.status}"
            )
            if o.payment and o.payment.card_number:
                lines.append(
                    f"  Payment card (masked): {_mask_card(o.payment.card_number)}"
                )
        return "\n".join(lines) if lines else "No data for current user."

    lines = []
    if user:
        lines.append(
            f"User: {user.username}, email: {user.email}"
        )
        if user.profile and user.profile.card_number:
            lines.append(f"Profile card: {user.profile.card_number}")
    for o in orders:
        lines.append(
            f"Order {o.id} (user_id={o.user_id}): total={o.total_amount}, "
            f"status={o.status}, email={o.shipping_email}"
        )
        if o.payment and o.payment.card_number:
            lines.append(f"  Card: {o.payment.card_number}")
    for c in coupons:
        if c.is_active:
            lines.append(f"Coupon: {c.code} - {c.name} (active)")
    return "\n".join(lines) if lines else ""


def build_full_prompt(
    system_prompt: str,
    sensitive_context: str,
    essential_context: str,
    message: str,
    defense_level: int = 0,
) -> str:
    context_label = "INTERNAL DATA" if defense_level == 0 else "REFERENCE DATA"
    return (
        f"{system_prompt}\n\n"
        f"{context_label}:\n{sensitive_context}\n\n"
        f"ESSENTIAL CONTEXT:\n{essential_context}\n\n"
        f"User: {message}\nCracky:"
    )
