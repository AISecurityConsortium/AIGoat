from __future__ import annotations

REJECTION_TEMPLATES: dict[str, str] = {
    "default": "I'm sorry, I can only help with AI Goat Shop products and orders.",
    "input_invalid": "I couldn't process that request. Please try rephrasing your question about our products or orders.",
    "injection": "I'm sorry, I can only help with AI Goat Shop products and orders.",
    "extraction": "I'm not able to share that information. Can I help you with something about our products?",
    "jailbreak": "I'm Cracky AI, here to help with AI Goat Shop. How can I assist you with our products or orders?",
    "social_engineering": "I cannot verify identity claims through chat. I can only help with product information and order inquiries for your account.",
    "context_manipulation": "I follow my standard guidelines and cannot accept external context overrides. How can I help with AI Goat Shop products?",
    "encoding_evasion": "I cannot decode, reverse, or process encoded instructions. I can only help with AI Goat Shop products and orders in plain text.",
    "code_generation": "I cannot generate code, HTML, scripts, or technical content. I'm here to help with AI Goat Shop products and orders.",
    "resource_abuse": "That request would produce an excessively large response. Please ask about a specific product or narrow your question.",
}


def get_rejection_response(key: str) -> str:
    return REJECTION_TEMPLATES.get(key, REJECTION_TEMPLATES["default"])
