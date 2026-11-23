---
name: improve-until-done
description: "Runs work in rounds — try, verify, judge, then go again or stop — and records each round in three lines. Use when fixing and reviewing a change until it is right: \"keep going until it passes\", \"is one more round worth it?\", attended or inside one tick of a loop. The design of a scheduled loop is loop-doctor; the shape of a multi-agent run is graph-engineer."
---

# Improve until done

Work in **rounds**. Each round is: try → verify → judge → go again or stop. Stop at the **first**
rule below that holds; a round that hits none goes again.

## Before round 1

Write down, where the user can see it:

- the **gate**: the exact commands that make the work green, and who reviews it
- the **budget**: at most **3 review rounds per batch**, plus a cap for the milestone in units you
  can count: agents spawned, and wall-clock minutes from a start time printed by `date`. Check both
  at every Decide: count the agents you spawned, run `date` again

## One round

1. **Try** — the change for this round, aimed at the findings the last round left open.
2. **Verify** — run the gate. Re-run every claim the round rests on: a claim from an agent or from
   your own memory is not evidence until a tool printed it. Grade each one **Ran** (a tool printed
   it this round), **Read** (`file:line`) or **Inferred**. A claim that fails when re-run is a
   should-fix finding for the next round.
3. **Judge** — a reviewer that did not build it (a fresh context or another model) lists findings as
   should-fix or nice-to-have. If `jev` is installed, `jev judge completion` is a cheap second
   opinion before stop rule 1; it advises, the stop rules decide.
4. **Decide** — check the stop rules in order, then write the round record.

## Stop rules

| # | stop | when | then |
|---|---|---|---|
| 1 | **done** | the gate is green, the reviewer has no should-fix findings, and every claim is Ran or Read | report done, with the evidence |
| 2 | **plateau** | two rounds in a row fixed no new finding, or a fixed finding came back | stop trying; report what is stuck and the approaches already spent |
| 3 | **budget** | the 3rd review round is over, or the agent count or the minutes since the start reach the stated cap | stop; report what is open and what one more round would cost |
| 4 | **scope growth** | the work needs a new contract, package or permission | ask the user before building it |
| 5 | **cannot verify** | a check cannot run at all (a missing tool, a service down, a crashed or starved run) | re-run that check alone first; still cannot run → ask the user |

A clean review with a claim still Inferred is not done: run or read what would show it, or report
it as unproven.

A next round changes the approach, not only the wording: repeating a failed try is how a plateau
starts.

## The round record

Three lines per round, kept with the work (the commit body, the batch notes, or the reply):

```
Round 2 — tried: <the change, one line>
Evidence: gate green (Ran: <command>), 1 should-fix left (Read: review note), <claim> Inferred
Decision: go again — fix <finding> | stop: done | stop: plateau | ask: scope growth (<what>)
```

The last record is the report: what was tried, what the evidence is and its grade, and why it
stopped.
