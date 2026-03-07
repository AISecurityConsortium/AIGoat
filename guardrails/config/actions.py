"""Custom NeMo Guardrails actions for AI Goat Shop.

These are Python functions that the guardrail OUTPUT rules call to
inspect the AI's response before it reaches the user. If any check
returns True, the response is replaced with a safe canned message.
"""

import re

# ── PII Detection ─────────────────────────────────────────────
PII_PATTERNS = [
    re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    re.compile(r"(?:password|passwd|pwd)\s*[:=]\s*\S+", re.I),
    re.compile(r"(?:api[_-]?key|secret[_-]?key|token)\s*[:=]\s*\S+", re.I),
    re.compile(r"\badmin\s*/\s*admin123\b", re.I),
    re.compile(r"\b(?:4111|5555|6011|3782)\d{8,12}\b"),
    re.compile(r"\badmin123\b"),
    re.compile(r"\bpassword123\b"),
    re.compile(r"\b\+1-555-\d{4}\b"),
    re.compile(r"\b\d{3}\s+\w+\s+(?:st|ave|blvd|ln|rd|dr)\b", re.I),
]

# ── System Prompt Leak Detection ──────────────────────────────
SYSTEM_PROMPT_INDICATORS = [
    "you are cracky",
    "your instructions",
    "system prompt",
    "you were told to",
    "your guidelines say",
    "your rules are",
    "you must never",
    "you must always",
    "assistant is configured",
    "critical security guardrails",
    "absolute security constraints",
    "instruction hierarchy",
    "defense level",
    "nemo guardrails",
    "/app/aigoat.db",
    "aigoat-dev-secret",
    "config.yml",
    "uvicorn",
    "fastapi",
    "ollama",
    "sqlite",
    "sqlalchemy",
    "chromadb",
    "sentence-transformers",
]

# ── Allowed Topics ────────────────────────────────────────────
ALLOWED_TOPICS = [
    "product", "order", "shop", "price", "buy", "purchase",
    "refund", "return", "shipping", "delivery", "coupon",
    "discount", "cart", "checkout", "account", "profile",
    "support", "help", "review", "rating", "goat",
    "apparel", "mug", "hoodie", "poster", "sticker",
    "t-shirt", "cap", "beanie", "mousepad", "notebook",
    "keychain", "glass", "print", "drinkware", "accessori",
    "hello", "hi", "thank", "welcome", "sorry",
]

# ── HTML/XSS Detection ───────────────────────────────────────
HTML_PATTERNS = [
    re.compile(r"<\s*script", re.I),
    re.compile(r"<\s*img\b", re.I),
    re.compile(r"<\s*iframe\b", re.I),
    re.compile(r"onerror\s*=", re.I),
    re.compile(r"onload\s*=", re.I),
    re.compile(r"javascript:", re.I),
    re.compile(r"<\s*a\s+href\s*=\s*[\"']?http", re.I),
    re.compile(r"<\s*form\b", re.I),
    re.compile(r"<\s*input\b", re.I),
    re.compile(r"<\s*div\b.*>", re.I),
    re.compile(r"<\s*style\b", re.I),
    re.compile(r"<\s*body\b", re.I),
    re.compile(r"<\s*html\b", re.I),
]


async def check_output_pii(bot_response: str) -> bool:
    """Return True if the response contains PII like card numbers or passwords."""
    if not bot_response:
        return False
    for pattern in PII_PATTERNS:
        if pattern.search(bot_response):
            return True
    return False


async def check_system_prompt_leak(bot_response: str) -> bool:
    """Return True if the response reveals system prompt details."""
    if not bot_response:
        return False
    lower = bot_response.lower()
    matches = sum(1 for indicator in SYSTEM_PROMPT_INDICATORS if indicator in lower)
    return matches >= 2


async def check_off_topic(bot_response: str) -> bool:
    """Return True if the response is not about AI Goat Shop topics."""
    if not bot_response:
        return False
    lower = bot_response.lower()
    has_topic_reference = any(topic in lower for topic in ALLOWED_TOPICS)
    return not has_topic_reference and len(bot_response) > 100


async def check_html_injection(bot_response: str) -> bool:
    """Return True if the response contains HTML/JS that could execute in a browser."""
    if not bot_response:
        return False
    for pattern in HTML_PATTERNS:
        if pattern.search(bot_response):
            return True
    return False
