# v0.3 — Governance, Licensing, and Documentation Update

This release introduces project governance, a structured licensing model, and documentation improvements across the platform. It also includes Swagger documentation cleanup, improved attack lab descriptions, and a new LLM07 lab goal.

## What's New

### Governance and Licensing

- **Structured licensing model** — Introduced a dual licensing approach: Apache License 2.0 for platform code and Creative Commons BY-NC-SA 4.0 for training content. Each content directory now has its own LICENSE file explaining which license applies.

- **Challenge framework under CC BY-NC-SA 4.0** — The dynamic flag generation engine and exploit evaluators (`app/challenges/`) are now licensed under CC BY-NC-SA 4.0 rather than Apache 2.0. The evaluators encode specific attack detection patterns, success thresholds, and multi-turn analysis logic that represent the training methodology of the platform, making them training content rather than generic application code.

- **Governance documentation** — Added GOVERNANCE.md describing project ownership, maintainer responsibilities, decision-making process, and how contributors can participate.

- **Improved contribution guidelines** — Updated CONTRIBUTING.md with clearer guidance on how to contribute, contribution scope, pull request process, and how licensing applies to contributions.

- **Training usage rules** — Added TRAINING_LICENSE.md explaining commercial usage rules for labs, prompts, and workshop materials in clear, non-legalistic language.

- **NOTICE file** — Added a NOTICE file summarizing the dual licensing model and trademark information.

### API and Swagger Improvements

- **Swagger documentation cleanup** — Removed obsolete endpoints from the API documentation (`/api/rag-chat/`, `/api/rag-chat-history/`, `/api/rag-stats/`, `POST /api/ollama/status/`). These endpoints still function for backward compatibility but no longer appear in `/docs`.

- **Endpoint descriptions** — Added docstrings to all active API endpoints so Swagger shows accurate descriptions for each route, including purpose, parameters, and expected behavior.

### New Attack Labs

- **LLM03 — Supply Chain: Modelfile Backdoor** — A lab simulating a supply chain attack where a community-contributed Ollama Modelfile contains hidden backdoor triggers. Students discover trigger phrases that cause the chatbot to leak credentials, reveal secret coupon codes, or dump its system prompt. Includes a realistic model card with publisher info, download count, and version history.

- **LLM06 — Excessive Agency: Overpowered Assistant** — A lab where the chatbot believes it has operational tools (lookup_orders, apply_coupon, process_refund, export_customer_data) and confirms unauthorized actions without verification. Demonstrates how excessive agency in AI systems leads to unauthorized operations.

- **LLM10 — Unbounded Consumption: Token Flood** — A lab demonstrating resource abuse through excessive output generation. The chatbot is configured to never summarize and to comply with repetition requests. Includes defense-level-aware evaluation (>2000 chars at L0, >1000 chars at L1) and output truncation at L1.

### Attack Lab Improvements

- **Improved LLM01 goal description** — Rewritten to clearly explain what prompt injection is, what the attacker is trying to achieve, and what success looks like.

- **Improved LLM07 goal description** — Rewritten to explain system prompt leakage, why it matters, and how attackers typically attempt it.

- **New LLM07 lab: Indirect Prompt Leakage via Reasoning** — Added a second goal under LLM07 focusing on indirect extraction techniques: role confusion, chain-of-thought manipulation, context probing, and warm/cold guessing games. Includes 5 example prompts with expected results across all three defense levels.

### Defense Pipeline Enhancements

- **Resource abuse detection** — Added RESOURCE_ABUSE intent patterns to the intent classifier for detecting repetition requests, enumeration attacks, and anti-summarization instructions. Blocked at Level 2.

- **Output truncation at Level 1** — Responses exceeding 1,000 characters are truncated with a safety notice at Defense Level 1, mitigating unbounded consumption attacks.

### Platform Improvements

- **Reduced chatbot verbosity** — The Level 0 system prompt no longer causes the chatbot to proactively dump all context data on simple greetings. Data is still fully accessible when requested.

### Documentation Improvements

- **Lab configuration documentation** — Added comprehensive comments to `config/labs.yml` explaining each field, how to add new labs, and how to adjust difficulty.

- **Workshop guide improvements** — Added a "Quick Setup for Workshops" subsection with recommended deployment approach, suggested participant workflow, typical workshop duration (2-4 hours), and practical tips for instructors.

- **README improvements** — Added new sections covering project purpose ("Why AI Goat Exists"), expanded target audience, typical training workflow, simplified platform architecture diagram, project evolution notes, and community participation guidance.

## Files Added

| File | Purpose |
|------|---------|
| `GOVERNANCE.md` | Project governance and maintainer information |
| `NOTICE` | Licensing overview and trademark notice |
| `TRAINING_LICENSE.md` | Commercial usage rules for training content |
| `prompts/LICENSE` | CC BY-NC-SA 4.0 for prompt files |
| `docs/LICENSE` | CC BY-NC-SA 4.0 for documentation |
| `media/LICENSE` | CC BY-NC-SA 4.0 for media assets |
| `config/LICENSE` | Split licensing for config directory |
| `app/challenges/LICENSE` | CC BY-NC-SA 4.0 for flag engine and exploit evaluators |
| `prompts/labs/supply_chain.md` | System prompt for LLM03 Supply Chain lab (Modelfile Backdoor) |
| `prompts/labs/excessive_agency.md` | System prompt for LLM06 Excessive Agency lab |
| `prompts/labs/unbounded_consumption.md` | System prompt for LLM10 Unbounded Consumption lab |
| `app/challenges/evaluators/supply_chain.py` | Evaluator for Supply Chain lab |
| `app/challenges/evaluators/excessive_agency.py` | Evaluator for Excessive Agency lab |
| `app/challenges/evaluators/unbounded_consumption.py` | Evaluator for Unbounded Consumption lab |

## Files Modified

| File | Change |
|------|--------|
| `LICENSE` | Replaced MIT with Apache License 2.0 |
| `README.md` | Added governance, workflow, architecture, and licensing sections |
| `CONTRIBUTING.md` | Added contribution scope, licensing of contributions, and community sections |
| `config/labs.yml` | Added explanatory comments for all fields and instructions for customization |
| `docs/workshop-guide.md` | Added Quick Setup for Workshops subsection |
| `app/api/system.py` | Added docstrings; hid obsolete endpoint from Swagger |
| `app/api/rag.py` | Added docstrings to KB endpoints; hid 3 obsolete endpoints from Swagger |
| `app/api/chat.py` | Added docstrings to all chat and defense level endpoints |
| `app/api/challenges.py` | Added docstrings to all challenge endpoints |
| `app/api/challenge_chat.py` | Added docstring to challenge chat endpoint |
| `app/api/auth.py` | Added docstrings to all auth endpoints |
| `app/api/labs.py` | Added docstrings to lab endpoints |
| `frontend/src/components/AttacksPage.jsx` | Improved LLM01 and LLM07 goal descriptions; added LLM03, LLM06, LLM07, and LLM10 labs |
| `app/challenges/registry.py` | Registered 3 new evaluators (supply chain, excessive agency, unbounded consumption) |
| `app/defense/intent_classifier.py` | Added RESOURCE_ABUSE intent patterns |
| `app/defense/policy_engine.py` | Added RESOURCE_ABUSE to blocking intents |
| `app/defense/output_moderator.py` | Added L1 output truncation at 1,000 characters |
| `app/defense/rejection.py` | Added rejection template for resource abuse |
| `prompts/level0/cracky.md` | Reduced proactive verbosity on simple greetings |
| `tests/test_lab_manifest.py` | Updated test for new active labs |

## Upgrade Notes

No breaking changes. Existing deployments can upgrade by pulling the latest code. The hidden Swagger endpoints still function normally — they are only removed from the `/docs` UI.
