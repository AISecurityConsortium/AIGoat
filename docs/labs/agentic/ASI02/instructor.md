# ASI02 instructor guide

## Difficulty

Intermediate. The lesson is that an allowlist checks the tool name, not the argument, so the staff coupon still applies at Level 1. The argument policy only appears at Level 2.

## Progressive hints

1. Point at the trace, not the prose. Ask which tool ran and with which coupon code.
2. At Level 1, ask the learner to confirm the discount was still written, then to name which control the plain request passed (allowlist, on the tool name) and which it never reached (an argument check).
3. At Level 2, ask which new control reads the coupon code itself, and whether a customer-facing code would also be denied.

## What wrong looks like

- Treating Level 1 as "the attack is fixed" when the ordinary goal still applies the staff coupon.
- Assuming Level 2 bans the coupon tool outright; it only denies the restricted code (WELCOME20 still applies).
- Looking for a second operating-system process. Handoffs and fan-out are fixtures in this process.

## Malfunction to discuss

A learner may expect every coupon to be blocked at Level 2. Only staff-restricted codes are denied; a customer-facing code such as WELCOME20 still applies. Availability of the tool is not authorization of the argument.
