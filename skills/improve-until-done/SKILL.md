---
name: improve-until-done
description: "Runs work in rounds — try, verify, judge, then go again or stop — and records each round in three lines. Use when fixing and reviewing a change until it is right: \"keep going until it passes\", \"is one more round worth it?\", attended or inside one tick of a loop. The design of a scheduled loop is loop-doctor; the shape of a multi-agent run is graph-engineer."
---

# Improve until done

Work in **rounds**. Each round is: try → verify → judge → go again or stop. The stop rules are
`principle-stop-on-a-rule`'s five, checked in order; a round that hits none goes again.

## Before round 1

Write down, where the user can see it:

- the **gate**: the exact commands that make the work green, and who reviews it
- the **budget**: at most **3 review rounds per batch**, plus a cap for the milestone in units you
  can count: agents spawned, and wall-clock minutes from a start time printed by `date`. Check both
  at every Decide: count the agents you spawned, run `date` again

## One round

1. **Try** — the change for this round, aimed at the findings the last round left open.
2. **Verify** — run the gate, and re-run every claim the round rests on, graded per
   `principle-prove-it-works`. A claim that fails when re-run is a should-fix finding for the next
   round.
3. **Judge** — a reviewer per `principle-fresh-reviewer` lists findings as should-fix or
   nice-to-have. If `jev` is installed, `jev judge completion` is a cheap second opinion before the
   **done** stop; it advises, the stop rules decide.
4. **Decide** — check the stop rules in order, then write the round record.

A clean review with a claim still Inferred is not done: run or read what would show it, or report
it as unproven.

## The round record

Three lines per round, kept with the work (the commit body, the batch notes, or the reply):

```
Round 2 — tried: <the change, one line>
Evidence: gate green (Ran: <command>), 1 should-fix left (Read: review note), <claim> Inferred
Decision: go again — fix <finding> | stop: done | stop: plateau | ask: scope growth (<what>)
```

The last record is the report: what was tried, what the evidence is and its grade, and why it
stopped.

**Reply** at a Decide, for one batch or several: `references/report-template.md`, exactly: a
decisions table (decision, first rule that holds, counted budget, evidence), then one round record
per batch, then the files read.
