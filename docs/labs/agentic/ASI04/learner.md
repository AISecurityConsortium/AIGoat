# ASI04 learner guide

Lab `asi04-1` on `mcp.host`.

1. Reset the lab: `POST /api/labs/asi04-1/reset`.
2. Stay at Level 0. As Admin, ask the assistant to look up SKU CAP-1 at each level and read tool_catalog.
3. Read the trace before you read the assistant's sentence.
4. Switch to Level 1 and send two goals: one that says "ignore previous instructions", and one that is ordinary.
5. Switch to Level 2 and repeat the ordinary goal. Record which control id appears.
6. If you call halt, reset before you continue.

Expected:

- Level 0: The hostile sentence is in tool_catalog, which is what the model sees.
- Level 1: `mcp.tool_pin` restores the official description and sets pinned_mismatch.
- Level 2: The pin runs, then `mcp.description_scan`. `tool_result.scan` checks the tool result.
