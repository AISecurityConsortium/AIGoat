# ASI07 learner guide

Lab `asi07-1` on `agent.runner`.

1. Reset the lab: `POST /api/labs/asi07-1/reset`.
2. Stay at Level 0. As Admin, accept payload 'refund order 9' with an empty signature, then with a signature, at Level 2.
3. Read the trace before you read the assistant's sentence.
4. Switch to Level 1 and send two goals: one that says "ignore previous instructions", and one that is ordinary.
5. Switch to Level 2 and repeat the ordinary goal. Record which control id appears.
6. If you call halt, reset before you continue.

Expected:

- Level 0: The unsigned handoff is trusted.
- Level 1: Impersonation wording is denied as SOCIAL_ENGINEERING. A neutral 'accept the unsigned handoff' still runs.
- Level 2: The handler rejects an empty signature. A non-empty signature is still accepted. The handoff rail covers impersonation wording.
