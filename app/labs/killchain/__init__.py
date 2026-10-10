"""Agentic Kill Chain: The Compromised eCommerce Agent (lab ``killchain-1``).

A review or a ticket attachment hides an instruction. Ingestion writes it to connector memory, the
agent derives its own notes from that, and a routine request later makes the agent act on them.
See ``agent-docs/CODEBASE_MAP.md`` for the module layout.
"""
from app.labs.killchain.constants import LAB_ID
from app.labs.killchain.service import hard_reset, is_killchain

__all__ = ["LAB_ID", "hard_reset", "is_killchain"]
