### Landing

**Only the approved version lands, after a final check run alone.**

1. Confirm the yes covers this exact version: the tip the owner saw is the tip you land. Anything
   committed since → ask again.
2. The repository's own landing step, if it has one (e.g. an approval stamp or a land script);
   otherwise `solo-flow`: squash, then rebase onto the main branch.
3. Final check: the full suite, run alone, on the rebased tip (`principle-guard-the-machine`).
4. Fast-forward the main branch. Push only when the repository's rules and the owner say so.
5. Clean up: remove the worktree, delete the work branch, update the queue item.

**Reply:** the landed commit, the final check (Ran), what was cleaned up, and anything not pushed.
