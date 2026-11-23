### Refactor

**Same behaviour, better structure. Prove the "same".**

1. Name the structure you want and why, in one paragraph. Delete before you add
   (`principle-subtract-before-you-add`).
2. Pin the behaviour first: the tests that cover it, run green (Ran). Thin coverage → write
   characterisation tests and run them green before changing anything.
3. `blast-radius` on what the refactor moves: callers, exports, stored formats.
4. Change in small steps, each ending green. Migrate the callers and delete the old path in the same
   batch.
5. Parity: the same tests, unedited, green after. A test you had to edit marks a behaviour change;
   name it.
6. `review` the diff against "no behaviour change".
7. Land through the `feature` playbook's steps 7–9.

**Reply:** the structure before and after in two lines, the parity evidence (Ran), the net line
count, and any behaviour change found.
