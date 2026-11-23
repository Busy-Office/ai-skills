### Refactor

**Same behaviour, better structure. Prove the "same".**

1. Open a worktree and a branch (the `feature` playbook's Worktree step).
2. Name the structure you want and why, in one paragraph. Delete before you add
   (`principle-subtract-before-you-add`).
3. Pin the behaviour first: the tests that cover it, run green (Ran). Thin coverage → write
   characterisation tests and run them green before changing anything.
4. `busy-office:blast-radius` on what the refactor moves: callers, exports, stored formats.
5. Change in small steps, each ending green. Migrate the callers and delete the old path in the same
   batch.
6. Parity: the same tests, unedited, green after. A test you had to edit marks a behaviour change;
   name it.
7. `busy-office:review` the diff against "no behaviour change".
8. Land through the `feature` playbook's Final check, Explain and Land steps.

**Reply:** the structure before and after in two lines, the parity evidence (Ran), the net line
count, and any behaviour change found.
