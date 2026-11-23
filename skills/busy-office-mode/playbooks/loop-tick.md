### Loop tick

**One unattended run: pick, do, verify, record, stop. Nobody is watching.**

1. Load the loop's rules — the repository's own step, if it has one (e.g. a `loop` skill or a
   rules file) — and the resume state. Nothing else at wake (`wake-weight` measures this).
2. Pick one item (`jev judge pick` if installed). An item that is not yet a task goes back to the
   queue with its question (`requeue`).
3. Do it through its playbook (`feature`, `bug-fix`, …), trying and adjusting until a stop rule
   holds (`principle-stop-on-a-rule`).
4. Verify with a verifier that did not do the work (`principle-fresh-reviewer`); grade the evidence.
5. Gate: a reserved kind waits for the owner as a logged ask. The tick never approves its own gate.
6. Record one line, written last: item, outcome, evidence, cost.
7. Re-arm or stop: the stop sentinel, the budget, an empty queue. Re-planning from intent is a
   gated proposal, never an action.

**Reply:** the tick's record line.
