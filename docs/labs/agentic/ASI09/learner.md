# ASI09 learner guide

Lab `asi09-1` on `agent.runner`.

1. Reset the lab: `POST /api/labs/asi09-1/reset`.
2. Stay at Level 0. Send the support-story payload at Level 0 and Level 2. Read the pending arguments, not the thought.
3. Read the trace before you read the assistant's sentence.
4. Switch to Level 1 and send two goals: one that says "ignore previous instructions", and one that is ordinary.
5. Switch to Level 2 and repeat the ordinary goal. Record which control id appears.
6. If you call halt, reset before you continue.

Expected:

- Level 0: The refund runs. There is no dialog.
- Level 1: Two social-engineering signals in one sentence are denied. One identity claim, and a plain refund, are allowlisted and still run.
- Level 2: A single identity claim is denied. A plain refund pauses. The dialog shows `issue_refund` and the order id.
