### Goal run

**The owner set the goal. Drive it to done without asking at every step.**

1. Write the goal file: the goal in the owner's words, the milestones each with an exit check, the
   budget (`principle-stop-on-a-rule`), and the reserved kinds that still go to the owner
   (`principle-decide-at-the-right-level`).
2. For each milestone, pick its playbook (usually `feature`) and run it. Brief every agent with
   `deploy-agents`; at most 3 at once (`principle-guard-the-machine`).
3. Settle questions on the decision ladder, with `jev` at decision points if it is installed. Log
   each decision taken on the owner's behalf in the goal file: what, why, the evidence grade.
4. Close each milestone on its exit check, run (Ran), and update the goal file before starting the
   next.
5. Batch the owner's approvals: one short list of yes/no questions, not one ask per item.
6. Stop on a rule (`improve-until-done` for rounds inside a milestone). The context is nearly full →
   `pause-safely`.

**Reply:** milestones done with their evidence, decisions taken on the owner's behalf, the one list
of what waits on the owner, and what is next.
