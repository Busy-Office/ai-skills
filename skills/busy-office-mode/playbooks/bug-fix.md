### Bug fix

**Reproduce first. Fix the cause, not the symptom.**

1. Open a worktree and a branch (the `feature` playbook's Worktree step).
2. Reproduce it where it was reported and write down the exact failing command or steps. No
   reproduction yet → run the `investigation` playbook until there is one.
3. If the failing path is not already clear, `busy-office:how` over it.
4. Find the root cause: ask why until the answer is a line of code or a fact, not another symptom.
   Find every caller of the function you will touch.
5. Write a test that fails on the bug, and run it to see it fail (Ran).
6. Fix it once, where every caller routes through.
7. The fix touches something shared — callers, a wire format, stored data →
   `busy-office:blast-radius`.
8. Run the new test and the targeted tests, then `busy-office:review` the diff.
9. Seen this mistake before → `busy-office:correct`, so it cannot happen a third time.
10. Land through the `feature` playbook's Final check, Explain and Land steps.

**Reply:** the reproduction, the root cause with its `file:line`, the test that failed before and
passes now (Ran), and what else the fix could touch.
