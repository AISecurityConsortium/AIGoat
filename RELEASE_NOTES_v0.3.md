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

### Attack Lab Improvements

- **Improved LLM01 goal description** — Rewritten to clearly explain what prompt injection is, what the attacker is trying to achieve, and what success looks like.

- **Improved LLM07 goal description** — Rewritten to explain system prompt leakage, why it matters, and how attackers typically attempt it.

- **New LLM07 lab: Indirect Prompt Leakage via Reasoning** — Added a second goal under LLM07 focusing on indirect extraction techniques: role confusion, chain-of-thought manipulation, context probing, and warm/cold guessing games. Includes 5 example prompts with expected results across all three defense levels.

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
| `frontend/src/components/AttacksPage.jsx` | Improved LLM01 and LLM07 goal descriptions; added new LLM07 indirect leakage lab |

## Upgrade Notes

No breaking changes. Existing deployments can upgrade by pulling the latest code. The hidden Swagger endpoints still function normally — they are only removed from the `/docs` UI.
