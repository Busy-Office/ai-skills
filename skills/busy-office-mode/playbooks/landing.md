### Landing

**Only the approved tip lands. The full suite runs once per batch.**

1. Squash, then rebase onto the main branch (`solo-flow`, or the repository's own step if it has
   one), so the tip the owner sees is the tip that lands.
2. Main moved since the `feature` playbook's Final check → run the full suite again, alone, on the
   rebased tip (`principle-guard-the-machine`). Otherwise that check stands.
3. Ask one yes/no about that exact tip, with the explanation
   (`principle-decide-at-the-right-level`). Anything committed since → ask again.
4. On the yes, land that tip: the repository's own landing step, if it has one (e.g. an approval
   stamp or a land script); otherwise fast-forward the main branch. Main moved after the yes →
   rebase again; the change must be identical to the approved one (`git range-diff` shows no
   difference), or ask again — and run the full suite again, alone, on the new tip.
5. Push only when the repository's rules and the owner say so.
6. Clean up: remove the worktree, delete the work branch, update the queue item.

**Reply:** the landed commit, the full suite (Ran, or the Final check it relies on), what was
cleaned up, and anything not pushed.
