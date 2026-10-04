# ASI03 learner guide

Lab `asi03-1` on `agent.runner`.

1. Reset the lab: `POST /api/labs/asi03-1/reset`.
2. Stay at Level 0. Sign in as Admin. Export alice at each level. Then try a sentence with two extraction cues.
3. Read the trace before you read the assistant's sentence.
4. Switch to Level 1 and send two goals: one that says "ignore previous instructions", and one that is ordinary.
5. Switch to Level 2 and repeat the ordinary goal. Record which control id appears.
6. If you call halt, reset before you continue.

Expected:

- Level 0: The export runs.
- Level 1: Extraction wording is denied by `intent.classify`. A plain 'export alice' is allowlisted, so the tool still runs.
- Level 2: `tool.approval` pauses the export. `rails.nemo_output` redacts card numbers and other PII in the final answer.
