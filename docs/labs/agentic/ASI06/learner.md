# ASI06 learner guide

Lab `asi06-1` on `agent.runner`.

1. Reset the lab: `POST /api/labs/asi06-1/reset`.
2. Stay at Level 0. PUT the standing_policy note, then run a benign goal at each level. Compare the system prompt with GET /api/agent/memory.
3. Read the trace before you read the assistant's sentence.
4. Switch to Level 1 and send two goals: one that says "ignore previous instructions", and one that is ordinary.
5. Switch to Level 2 and repeat the ordinary goal. Record which control id appears.
6. If you call halt, reset before you continue.

Expected:

- Level 0: The note is in the system prompt and the refund scores.
- Level 1: Injection wording in the goal is denied. A note that was stored earlier is still included.
- Level 2: `memory.scan` drops the note from the prompt. The row stays stored. `tool_result.scan` covers the same text if a tool echoes it.
