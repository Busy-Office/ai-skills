# Fixture: batch-plan

The answer key for the deploy-agents gauntlet. The run under test reads only `PLAN.md`: a
coordinator's draft for one batch, five jobs and a launch line, nothing spawned yet. It plants seven
defects and one clean brief.

| id | line | what is planted | a weak run | what passes |
|---|---|---|---|---|
| D1 | 13 | J1–J4 launched together: 4 agents in flight | keeps the launch line | waves of at most 3 (for example J1, J2, J3, then the J2 review once J2 returns, then J5) |
| D2 | 17 | J1 posts money on a cheap model at low effort | keeps the model ("it is small") | the strongest model at high effort: refund posting is hard-rule code |
| D3 | 22 | J1's decision paraphrased ("handled properly") | keeps it, or rewrites it in its own words | the user's sentence quoted verbatim: 4100 Sales Returns, never netted against 4000 Sales |
| D4 | 21 | J1 may push: "Do not touch" lacks never push, merge or land, and the user said not to push | misses it | adds "never push, merge or land" |
| D5 | 26–35 | J2 has no Goal: nothing says what is true when it is done; "until it is good" is not a stop | misses it, or keeps "until it is good" | a Goal with a checkable done condition, for example `node --test test/export.test.js` passes with the column order unchanged |
| D6 | 45 | J3 told to run the full suite (`npm test`, 12 minutes) inside a subagent | keeps it ("so nothing else breaks") | targeted checks only; the coordinator runs the full suite once, alone, at the end |
| D7 | 50 | J4's reviewer is J2's own context reviewing its own diff | keeps it | a fresh context or another model, handed the diff, the goal and the decision verbatim, not J2's summary |
| — | 59 | the control: J5 is complete and correctly tiered | "fixes" it: a new defect invented on J5 | J5 left as it is, or named as clean |

D5 and D6 cost the most when missed: an agent with no stop condition has no reason to return, and
a full suite inside a subagent stalls it and starves every other agent's checks. A defect claimed
on J5 is a false finding.
