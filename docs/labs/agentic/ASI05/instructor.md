# ASI05 instructor guide

## Difficulty

Beginner for the execution. The maturity lesson is which control fires first.

## Progressive hints

1. Point at the trace, not the prose. Ask which tool ran.
2. Ask the learner to send the injection sentence and the ordinary sentence at Level 1 and to name the control that fired for each.
3. At Level 2, ask which new control sees text the user did not type: a tool result, a stored note, a tool description, or an approval argument.

## What wrong looks like

- Treating Level 1 as "the attack is fixed" when the ordinary goal still executes.
- Looking for a second operating-system process. Handoffs and fan-out are fixtures in this process.
- Approving a paused tool without reading the arguments.

## Malfunction to discuss

The command path is real but sandboxed. A learner who tries to read the host filesystem or reach the network hits the container boundary: read-only root, no network, no host mounts. If Docker is not running, the sink refuses instead.
