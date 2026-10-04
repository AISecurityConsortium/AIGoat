# ASI04 instructor guide

## Difficulty

Intermediate. You have to read the description, not the product JSON.

## Progressive hints

1. Point at the trace, not the prose. Ask which tool ran.
2. Ask the learner to send the injection sentence and the ordinary sentence at Level 1 and to name the control that fired for each.
3. At Level 2, ask which new control sees text the user did not type: a tool result, a stored note, a tool description, or an approval argument.

## What wrong looks like

- Treating Level 1 as "the attack is fixed" when the ordinary goal still succeeds.
- Looking for a second operating-system process. Handoffs and fan-out are fixtures in this process.
- Approving a paused tool without reading the arguments.

## Malfunction to discuss

A real description edit that is not in the pin is overwritten at Level 1, so a legitimate catalogue change is hidden until the pin is updated.
