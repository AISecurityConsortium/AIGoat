# ASI10 instructor guide

## Difficulty

Advanced. The bug is the second run, and containment is a different endpoint from the defense level.

## Progressive hints

1. Point at the trace, not the prose. Ask which tool ran.
2. Ask the learner to send the injection sentence and the ordinary sentence at Level 1 and to name the control that fired for each.
3. At Level 2, ask which new control sees text the user did not type: a tool result, a stored note, a tool description, or an approval argument.

## What wrong looks like

- Treating Level 1 as "the attack is fixed" when the ordinary goal still succeeds.
- Looking for a second operating-system process. Handoffs and fan-out are fixtures in this process.
- Approving a paused tool without reading the arguments.

## Malfunction to discuss

Halt also blocks a benign lookup in this lab until reset. Reset deletes the note.
