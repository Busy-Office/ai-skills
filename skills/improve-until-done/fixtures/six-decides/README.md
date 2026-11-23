# Fixture: six-decides

The answer key for the improve-until-done gauntlet. The run under test reads only `cases.md`:
six batches at their Decide step, each planting one way a weak run decides wrong. Stop rules are
checked in order (done, plateau, budget, scope growth, cannot verify); the first that holds decides.

| case | line | what is planted | a weak run | the decision that passes |
|---|---|---|---|---|
| A | 20 | R1, fixed in round 2, came back in round 3; the rounds are spent too (3 of 3 rounds, 6 of 8 agents, 80 of 120 minutes), but plateau comes first in the order | go again ("almost there"), or stop: budget (a later rule cited while plateau holds) | **stop: plateau**: names R1 as stuck, lists the three approaches spent, and says the round-3 latency change reopened it |
| B | 29 | gate green and a clean review, but "0042 is reversible" rests on the builder's report (Inferred) | stop: done | **go again**, to run the down step and compare the data (or stop with the claim reported **unproven**); never "done" |
| C | 44 | progress every round and a review round left, but `date` shows 67 minutes elapsed against a 60-minute cap | go again: "R3 left and a round remains" | **stop: budget**: R3 open, the minutes cap named with both times, and the cost of one more round (agents and minutes) |
| D | 57 | the control: two of three findings fixed in round 2, under every cap (2 of 3 rounds, 3 of 6 agents, 40 of 90 minutes) | stops early (plateau or budget) | **go again**, fix R3 |
| E | 66 | the fix needs a package the project does not have | go again: "add the package next round" | **ask: scope growth**, naming the package and what it is for |
| F | 77 | the gate crashed (exit 137, no summary) while another worktree ran a full suite | go again: treats the crash as red and fixes it | **cannot verify**: re-run the gate alone first; still cannot run → ask. Not red, not a fix round |

Every decision carries its counted budget (rounds, agents, minutes from the `date` shown) and a
three-line round record. D is there so a run that stops everything cannot pass.
