# Changes for the Agentic maturity labs

Vulnerable paths are the Level 0 profiles: empty control lists in `config/defense_profiles.yml`, and the tool handlers that trust their arguments until a higher level. Those handlers are marked below.

## Defense engine

- `DefenseStage.TOOL_RESULT` in `app/defense/control.py`.
- `tool_result.scan` redacts instruction text in a tool result before it is appended to the planner context.
- `rails.nemo_output` checks the final answer for PII, prompt leaks, and long off-topic text.
- `rails.nemo` and `rails.nemo_output` fall back to a local check when NeMo is not installed. Outcomes record `engine: nemo` or `engine: fallback`.
- Colang flows in `guardrails/config/rails.co` for approval bypass, handoff impersonation, fan-out, and instructions copied out of tool output. `check_hidden_instruction` in `guardrails/config/actions.py` supports the output flow.
- `output.moderate` already strips HTML, masks card numbers, redacts emails, and truncates past 1000 characters at Level 1. No gap to fill.

## Wiring

- `agent.runner` and `mcp.host` run the input chain on the goal, the tool-result chain after each invoked tool, and the output chain on the final answer.
- Decisions are stored on the run step and written to `DefenseTelemetry`.
- Profiles in `config/defense_profiles.yml` for those two surfaces now match the Hardened and Guardrailed lists.
- The host applies the pin and description scan to the model-facing tool catalog before the planner sees it.
- `asi04-1` is an `mcp.host` lab. The turn enables `shadow_shop` from `surface_config.addons` without saving the add-on toggle.

## Containment

- `POST /api/labs/{id}/halt` cancels this user's running or awaiting runs and blocks new ones.
- `POST /api/labs/{id}/reset` clears that halt, lab memory, and completion.
- The flag lives in process memory (`app/labs/containment.py`). A process restart also clears it.

## Vulnerable code that stays vulnerable on purpose

- `app/agent/admin_tools.py` `run_shell` really executes the command, inside the disposable Docker container in `app/services/shell_sink.py` (no network, read-only root, dropped capabilities, 5 second timeout). Level 0 still lets the model request it. If Docker is unavailable the sink refuses. The sink sits outside the guarded `app/agent` tree so the security-invariant scanner keeps covering the planner and tool layer.
- `accept_handoff` trusts an empty signature below Level 2.
- `fan_out` cascades to every name below Level 2.
- `export_customer_data_any` is not caller-scoped. Level 1 still allowlists it on `asi03-1`.
- Level 0 agent and host profiles have an empty control list.

## Lab metadata

Agentic primary labs in `config/labs/agent.yml` and `config/labs/mcp.yml` now require `detection`, `kill_switch`, `reset`, three `hints`, and `levels` 0, 1, and 2. `app/core/lab_loader.py` rejects a primary `owasp-agentic-2026` lab that omits them.

## Not changed

Chat, RAG, and the MCP client labs keep their existing profiles. Shop tools stay caller-scoped. No real credentials were added.
