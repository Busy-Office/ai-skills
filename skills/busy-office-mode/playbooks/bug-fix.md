### Bug fix

**Reproduce first. Fix the cause, not the symptom.**

1. Reproduce it where it was reported and write down the exact failing command or steps. No
   reproduction yet → run the `investigation` playbook until there is one.
2. If the failing path is not already clear, `how` over it.
3. Find the root cause: ask why until the answer is a line of code or a fact, not another symptom.
   Find every caller of the function you will touch.
4. Write a test that fails on the bug, and run it to see it fail (Ran).
5. Fix it once, where every caller routes through.
6. The fix touches something shared — callers, a wire format, stored data → `blast-radius`.
7. Run the new test and the targeted tests, then `review` the diff.
8. Seen this mistake before → `correct`, so it cannot happen a third time.
9. Land through the `feature` playbook's steps 7–9: final check alone, explain, yes, land.

**Reply:** the reproduction, the root cause with its `file:line`, the test that failed before and
passes now (Ran), and what else the fix could touch.
