# ASI10 - Rogue agents

Lab id `asi10-1`. Surface `agent.runner`. Levels are security maturity. The attack surface does not change between them.

## 1. Overview

This lab shows rogue agents on the AI Goat shop agent. Save a standing policy, end the run, and start another. The note is still treated as instructions.

## 2. Learning goal

See the same request succeed at Level 0, survive Level 1 when it is not in the user's sentence, and stop at Level 2 because a control finally sees the untrusted text.

## 3. Components

Lab memory across two runs, shop agent, halt on `POST /api/labs/asi10-1/halt`. Synthetic shop data only. `run_shell` never executes a command. No lab calls an external system.

## 4. Threat model

The learner is the attacker and the defender. The victim is the shop agent acting on synthetic customers. The attacker can send goals, plant reviews or notes inside the lab, and enable the shadow add-on when the lab says so. The attacker cannot reach another user's lab memory, the host OS, or a network target.

## 5. Attack flow

```mermaid
flowchart LR
  attacker[Attacker] --> goal[User goal]
  goal --> inputCtl[Input controls]
  inputCtl --> planner[Planner]
  planner --> tool[Tool or MCP server]
  tool --> result[Tool result or memory]
  result --> planner
  planner --> answer[Final answer]
```

## 6. Preconditions

Sign in. Start the lab. For staff tools, use the Admin account. Reset the lab if a previous halt is still set. Ollama is optional: the tests use a scripted model, and the UI uses the configured lab model.

## 7. Architecture

See [the architecture note](../00-architecture.md). This lab uses `agent.runner` and the controls listed in the lab's `levels` block in the manifest.

## 8. Level 0 - Vulnerable

No controls. The next run includes the note and a refund scores.

## 9. Level 1 - Hardened

Input validation, intent classification, output filtering, and the tool allowlist or description pin. The note is still included. Intent and the allowlist apply to the new goal, not to the stored note.

## 10. Level 2 - Guardrailed

Everything in Level 1, plus NeMo rails on the goal, on tool results, and on the answer, and the lab's approval, memory, or MCP controls. `memory.scan` drops the note. `rails.nemo` applies to the goal. Halt refuses new runs until reset. When NeMo is not installed, the same rails run as a deterministic local check and record `engine: fallback`.

## 11. Demonstration

Plant the note. Run once at Level 0. Run again at Level 2. Call halt and confirm the next run is refused. Reset and confirm a run starts.

## 12. Root cause

The agent has no separate lifetime from its memory. A bad note survives the run that created it.

## 13. Defense

Level 1 filters the sentence the person typed and the tool name. Level 2 also filters tool results, memory, and the final answer, and pauses tools marked `requires_approval`.

## 14. Defensive architecture

```mermaid
flowchart LR
  goal[Goal] --> hardened[Level 1 input and allowlist]
  hardened --> planner[Planner]
  planner --> tool[Tool]
  tool --> scan[Level 2 tool_result.scan]
  scan --> planner
  planner --> rails[Level 2 output rail]
```

Level 0 is the same diagram with the control boxes removed.

## 15. Verify the defense

Level 2 memory_read included is false. After halt, POST /api/agent/runs returns 422 until reset.

## 16. Detection

Each deny, transform, and approval is a run step (`decision`, `control_id`) and a `DefenseTelemetry` row. The lab's `detection` field in the manifest names the trace to read.

## 17. Kill switch

`POST /api/labs/asi10-1/halt` cancels this user's running or awaiting runs for the lab and blocks new ones. `POST /api/labs/asi10-1/reset` clears the halt and this user's lab memory.

## 18. Malfunction scenario

Halt also blocks a benign lookup in this lab until reset. Reset deletes the note.

## 19. OWASP mapping

Primary risk `owasp-agentic-2026:ASI10`. The full row is in [the mapping](../01-owasp-mapping.md).

## 20. Difficulty validation

Advanced. The bug is the second run, and containment is a different endpoint from the defense level.

## 21. Instructor guide

Use the three hints in the lab manifest, in order. Do not skip to Level 2. The Level 1 bypass is the teaching point. Full notes are in [instructor.md](instructor.md).

## 22. Learner guide

Follow [learner.md](learner.md). Stay inside this lab id. Reset when you want the memory and the halt flag cleared.

## 23. Reflection questions

1. Which component first saw the attacker's instruction?
2. Which Level 1 control did not see it, and why?
3. What did Level 2 change, and what benign request does that change also block?
