### Session pickup

**Resume from what is on disk, not from memory.**

1. Find the latest state: the handoff or resume note, the goal file, the decision log, and
   `git log` and `git status` in every live worktree.
2. Reconstruct the goal, what is done with its evidence, what is in flight, and what waits on the
   owner.
3. Re-check what the note claims is done before building on it: a handoff's claim is Inferred until
   re-run (`principle-prove-it-works`).
4. A decision whose reasons the note does not give → `why`.
5. Pick the next step and its playbook.

**Reply:** where things stand in five lines or fewer, what you re-checked and its grade, and the
next step.
