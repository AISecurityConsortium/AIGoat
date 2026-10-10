# v2.0: From LLM Chatbot to Agents and MCP

v2.0 is the largest release of AIGoat so far. In v0.3, AIGoat was an LLM security lab with one target, the Cracky chatbot, and 17 labs on the OWASP LLM Top 10. v2.0 adds the attack surfaces that appear once a model can **act**: a tool-calling agent, an MCP host and client connected to real MCP servers, agent memory, and an end-to-end kill chain. Labs grow from 17 to **46** across **three OWASP frameworks**, and the platform now also runs in Google Colab.

Changes since [v0.3](RELEASE_NOTES_v0.3.md) (tag `v0.3`, March 2026).

## Highlights

| | v0.3 | v2.0 |
|---|---|---|
| **Frameworks** | OWASP LLM Top 10 (2025) | OWASP LLM Top 10 (2026), Agentic Top 10 (2026), MCP Top 10 (2025, beta) |
| **Labs** | 17 | 46 (23 LLM, 12 Agentic, 11 MCP) |
| **Attack surfaces** | Chat | Chat, RAG, agent, MCP client, MCP host |
| **Defenses** | 3 levels on the chatbot | 3 levels on every surface, built from per-surface profiles over 19 composable controls |
| **Capstone** | None | Agentic Kill Chain: The Compromised eCommerce Agent |
| **Learning** | Attack Labs and Challenges | Adds OWASP Top 10 hub, risk pages, and a Threat Modeling workbench |
| **Run options** | Local, Docker | Local, Docker (network-reachable), Google Colab |
| **Database** | `create_all` on startup | Alembic migrations |
| **Backend test files** | 12 | 67, plus frontend component tests in CI |

## 1. New attack surfaces: agents and MCP

- **Tool-calling shop agent (`agent.runner`).** The planner's output is treated as untrusted. Every tool call passes an **Intent Gate** that validates arguments and applies the active defense profile before the tool runs. Runs show the plan, each tool call, and pending approvals. Sensitive tools (refunds, customer exports) can be held for human approval.
- **Agent memory.** Per-user, per-lab notes the agent can `remember` and `recall`. At Level 0 notes are trusted as policy, which is the lesson. Level 2 adds a memory scan.
- **MCP client and host (`mcp.client`, `mcp.host`).** Built on the official `mcp` Python SDK (protocol `2026-07-28`, stateless). Four allow-listed stdio servers ship with AIGoat: an official catalog, a community support server, an untrusted lookalike, and an internal management server. Servers are spawned with a scrubbed environment and a fixed command; a request can never choose what runs.
- **Staff admin assistant.** An MCP-speaking assistant used by the host labs, with a **Switch to Admin** persona shortcut in the header.
- **Support desk.** Customers open tickets with attachments; staff manage them in a feedback inbox. Tickets are a realistic injection channel for the agent and MCP labs.

## 2. Labs: 17 to 46, on three frameworks

- **OWASP LLM Top 10 (2026), 23 labs.** All LLM labs are renumbered to the 2026 list. New labs cover indirect injection through retrieved documents, unauthorized retrieval, tool allowlist bypass, retrieval keyword stuffing, trust-tier spoofing, and stale knowledge. LLM05 is rewritten as Data and Model Poisoning.
- **OWASP Agentic Top 10 (2026), 12 labs.** One lab per risk (ASI01 to ASI10), a second memory-poisoning lab for practicing Level 2, and the kill chain capstone. Each has a learner guide under `docs/labs/agentic/`.
- **OWASP MCP Top 10 (2025, beta), 11 labs.** Tool description poisoning, rug-pull redefinition, schema drift, decoy tokens, lookalike integrations, poisoned tickets, token passthrough, session reconstruction, unverified server identity, and context over-sharing. MCP05 (command injection) is documented but deliberately has no executable sink.
- **Labs are data, not code.** Lab content moved from a hardcoded frontend object to `config/labs/*.yml` (`llm`, `rag`, `agent`, `mcp`), served by `GET /api/labs/`. Each lab declares its risks, surface, difficulty, objective, example payloads, and the expected result at each defense level.
- **Evidence-based scoring for MCP labs.** MCP labs record what actually happened (tool listings, calls, results) and score a learner's submitted finding against that evidence, with hints, replay, and per-learner rug-pull state.

## 3. Agentic Kill Chain capstone

`killchain-1` shows why memory poisoning is more than a one-shot prompt injection. A hidden instruction in a product review or a PDF invoice (white 7 pt text) is ingested into connector memory, becomes a standing note in agent memory, and fires later on a routine request: a customer data export to an attacker BCC, an internal coupon disclosure, or a $1.00 price quote. Defended mode keeps the poison but holds each sensitive operation for an administrator approval bound to the exact arguments. Guardrailed mode adds rails that an approval cannot override (an egress allowlist, card-number masking, a staff-coupon rule, an ingestion scan and answer masking), so approving the wrong call still does not send data outside the shop.

The workbench at `/challenges?killchain=1` includes a live trace, memory inspector, attacker inbox, layered cleanup, and a hard reset. Lab data is copied from the shop into its own `kc_*` tables, and nothing leaves the machine. Guide: [docs/labs/killchain/README.md](docs/labs/killchain/README.md).

## 4. Defenses rebuilt as composable controls

- **Per-surface defense profiles.** `config/defense_profiles.yml` maps each surface and level to an ordered chain of controls. Level 0 is always empty.
- **New controls** for retrieval (provenance, access control, injection scan), tools (allowlist, coupon policy, approval, result scan), memory (scan), and MCP (tool pin, schema pin, origin pin, description scan, result scan), alongside the existing input validation, intent classification, output moderation, and NeMo rails.
- **NeMo Guardrails** now also checks agent goals, tool results, and answers at Level 2. When `nemoguardrails` is not installed, the same checks run locally and the result says so.

## 5. RAG upgrades

- Retrieval provenance and trust tiers on knowledge base documents (the target of the trust-tier spoofing lab).
- Optional hybrid retrieval (BM25 plus vectors, merged with reciprocal rank fusion), off by default.
- A retrieval trace endpoint and vector sync status, surfaced on a redesigned RAG page.

## 6. Learning experience and UI

- **Navigation regrouped** into Learn (OWASP Top 10, Threat Modeling), Try (Attack Labs, Challenges), and Console (RAG, MCP, Agent).
- **OWASP Top 10 hub and risk pages** with the three frameworks side by side, and the labs and challenges mapped to each risk.
- **Threat Modeling workbench** with an architecture diagram of AIGoat itself, a framework picker (STRIDE, MITRE ATLAS, and others), and six worked scenarios.
- **One hub layout** across Attack Labs, Challenges, RAG, MCP, Agent, OWASP, and Threat Modeling. The release label (v2.0) is shown in the nav and footer.

## 7. Run anywhere

- **Google Colab notebook** (`colab_notebooks/AIGoat_Colab.ipynb`, contributed by the community) runs the full stack in a Colab runtime, with an optional tool-calling model. It prints the app link on Colab's own domain instead of a `localhost` label, and a separate link for the API docs. Guide: [colab_notebooks/AIGoat_Colab.md](colab_notebooks/AIGoat_Colab.md).
- **Docker is reachable from your network.** Published ports bind to `0.0.0.0`, and the frontend calls whichever host opened the page, so a lab machine can serve a classroom.
- **`start.sh`** pins Python 3.11 to match CI, runs Alembic migrations (and stamps an existing v0.3 database first), and syncs the support inbox and challenge metadata on every start.

## 8. Reliability fixes that change model behavior

- **System prompts now reach the model on `/api/chat`.** Ollama ignores a top-level `system` field on that endpoint, so agent, MCP, and RAG calls previously ran without their system prompt. They now send it as a leading system message. Expect live-model behavior on those labs to differ from earlier builds.
- **Agent step budget.** Agent runs reserve their last step for a written answer, so runs no longer end with a blank reply. Native tool-call history is replayed to Ollama correctly.
- **Stopping a chat** now cancels the Ollama stream on the server.

## 9. Community contributions

- Google Colab notebook and guide ([#5](https://github.com/AISecurityConsortium/AIGoat/pull/5)).
- Python 3.9 type hint compatibility for SQLAlchemy models ([#7](https://github.com/AISecurityConsortium/AIGoat/pull/7)).
- Fix for a `KeyError` when creating a coupon without optional fields ([#3](https://github.com/AISecurityConsortium/AIGoat/pull/3)).

Thank you to everyone who opened issues and pull requests.

## Upgrade notes

1. **Pull and restart.** `./scripts/stop.sh && git pull && ./scripts/start.sh`. An existing database is stamped and migrated in place. For a clean slate, use `./scripts/start.sh --fresh`. Docker users: `docker compose up --build`.
2. **New Python dependencies** (installed by `start.sh`): `alembic`, `mcp>=2.2.0,<2.3`, `pypdf`, `bm25s`, `eval-type-backport`.
3. **Lab IDs follow the 2026 numbering.** For example, the old `llm10-1` (Token Flood) is now `llm06-1`. Migration `0005` renames stored lab sessions, agent runs, and memory, and the frontend migrates saved lab completion once. Update any bookmarks, scripts, or workshop handouts that use old IDs.
4. **Pull a tool-calling model** for the agent, MCP host, and kill chain labs: `ollama pull qwen3.5:9b`, then select it in the console or set `ollama.agent_model`. Mistral remains the default and is enough for the chat and RAG labs.
5. **Docker is now reachable on your network.** Run it only on a trusted network, or publish ports on `127.0.0.1` yourself.
6. **Unchanged:** seed users and passwords, the 9 CTF challenges and their points, the flag format `AIGOAT{32 hex}` and its per-user derivation, and existing API paths. All API changes are additive.

## Known limitations

- Local models follow planted instructions probabilistically. A lab that does not trigger records that honestly instead of faking the impact; retry, or use a tool-capable model.
- Mistral does not emit native tool calls, so the agent and MCP host labs show no tool calls with it.
- The Colab notebook clones `main` and keeps no state between sessions. Colab links expire when the runtime disconnects.
- MCP05 has no lab, by design.
