# Audit checklist

Each item: what to check, why it matters when nobody is watching, and
how to classify a miss. Evidence is always file:line.

## What the checks measure

The items below are grouped by tick stage because that's the order you
audit in. They test seven qualities of the loop's *machinery* — not the
application code it edits, not whether the work it picks is valuable.

| dimension | the question | items that answer it |
|---|---|---|
| **Correctness** | Does the loop do what its files say it does? | dead references · terminal sentinel with entries after it · exit code vs documented meaning · thresholds that disagree · built vs declared |
| **Safety** | What can go wrong with nobody watching? | overlap guard · kill switch · async escalation channel · no self-approval · stop-classes for destructive change · enforced budgets · no swallowed setup errors |
| **Reliability** | Does it recover and conclude? | idempotence · green-or-reverted · no-progress and repeat-failure stops · steady state recognised |
| **Performance / cost** | What does each tick cost, and is it bounded? | size and growth of everything read at wake · archive rule · agents-per-tick · wall-time cap |
| **Maintainability** | Can a rule be changed in one place? | one canonical copy in the loaded file · counts agree · superseded designs removed · playbook vs archive |
| **Understandability** | Can a newcomer run it from the files alone? | one tick explainable end-to-end · the three questions answered once each · every file has a role · resume separate from history |
| **Observability** | Can you tell it's stuck without reading transcripts? | closed outcome vocabulary · one record per tick, written last · stuckness visible in the state file · metrics actually recorded |
| **Purpose** | Is the loop anchored to why the project exists, and does it know what to do when the queue runs dry? | an intent/objective document exists and is named in the loaded rules · the empty-queue ladder (steady state → re-plan from intent as proposals → bounded explore) · a periodic objective review · the loop reads intent and never writes it · roadmap items trace to intent |

If a review turns up nothing in a dimension, say so in one line — an
absent dimension reads as an unexamined one.

## Trigger and cadence

- **One trigger.** Exactly one thing fires a tick. Two (a cron entry and
  a driver with its own sleep loop; a script loop and an orchestrator
  skill with its own counter) means ticks can overlap and neither's stop
  rule is authoritative. → *Invalid* if both are live; *Risk* if one is
  dormant but still present.
- **Cadence stated once, agreed everywhere.** The interval in the
  scheduler matches every doc that mentions it. → *Redundant* if
  restated identically; *Invalid* if the numbers differ.
- **Overlap guard.** A tick that runs long must not be joined by the
  next one. Look for a lock, a "skip if running" check, or a scheduler
  that serialises. → *Risk* if absent.
- **Runs from the machine it's documented for.** A `.ps1` driver in a
  repo developed on macOS, a launchd plist on a machine that sleeps.
  → *Invalid* if the documented trigger cannot fire here.

## Wake

- **Read order is explicit and bounded.** "Read X first" rules exist,
  and the files they name are finite. Report each state file's line
  count and growth (the inventory gives both). → *Risk* above ~1,000
  lines with no archive rule; *Invalid* if a "read first" file doesn't
  exist.
- **Resume information is separate from history.** What the next tick
  needs (uncommitted work, open decision) is short and current; the log
  of what happened is elsewhere. → *Risk* when they are one file.

## Select

- **Deterministic selection.** The next unit of work is the first item
  of an ordered source, or a counter rule — not "the actor picks
  something valuable". → *Risk*; loops with actor-chosen targets drift
  toward busywork.
- **Empty-queue ladder.** What happens when nothing is unblocked, in
  order: steady state declared → re-plan from intent as gated proposals
  → bounded explore. → *Risk* if unstated (the loop will invent work);
  *Risk* if the only fallback is explore (the loop can't renew itself);
  *Invalid* if re-planning promotes its own proposals to accepted scope
  without a gate.

## Purpose

- **An intent document exists and the loop knows where it is.**
  `intent.md`, an Objective section, a charter — something that says why
  the project exists, not just what's next. The loaded rules name it in
  the wake read-order or in the empty-queue / objective step. → *Risk*
  if the loop has no purpose anchor; the roadmap becomes the purpose.
- **Periodic objective review.** A counter or cadence rule that
  re-reads intent against the roadmap even when the queue is not empty
  ("every 24th wake", "every 12th tick") and produces proposals or
  questions, not silent re-prioritisation. → *Risk* if absent on a loop
  that has run more than a few dozen ticks.
- **Intent is read-only for the loop.** Nothing in the rules lets the
  actor edit the intent document; a change to intent is always a human
  gate. → *Invalid* if the loop has written to it (check git log for
  agent-authored commits touching it).
- **Roadmap items trace to intent.** New items the loop proposes carry
  the intent clause they serve; the objective review can therefore find
  items that serve nothing. → *Risk* if items are untraceable.
- **Counter rules are consistent.** "Every 4th Continue", "every 12th
  tick", "later rows win": the same rule with the same numbers wherever
  stated, and the tie-break named. → *Invalid* on disagreement.

## Act

- **Budgets exist and are enforceable.** Agents per tick, wall time,
  attempts per target, change size. A budget with no mechanism is a
  wish. → *Risk* if absent; *Redundant* if restated with the same
  number; *Invalid* if restated with different numbers.
- **Change classes that stop.** Destructive migrations, new env vars,
  permission or dependency changes, money, legal: named as stop-or-
  escalate classes, once. → *Invalid* if the classes differ between
  files (e.g. the migration rule worded three ways).

## Verify

- **Separate verifier.** Done is decided by a different agent than the
  one that built, in a fresh context, read-only. → *Invalid* if the
  builder runs its own DoD and that is the only check.
- **Default-FAIL criteria.** Gate items start FAIL and are flipped by
  cited evidence (test output, sha, journal seq), not by assertion.
  → *Risk* if criteria default to pass or are checkbox-by-assertion.
- **Gates that can fail.** A gate that has never been seen red is not
  trusted; look for red-proofs or planted defects. → *Risk*.
- **Verify by running.** "Verified" claims cite a command and its
  output, not a reading of the code. → *Risk*.

## Gate

- **Block-or-log is decided once.** Every governing file agrees on
  whether a human gate halts the tick or is logged fail-closed and
  passed. → *Invalid* on disagreement.
- **No self-approval.** The actor cannot flip a human gate to approved.
  → *Invalid* if nothing prevents it.
- **Escalation channel + kill switch** exist for log-and-continue
  designs: a place the human reads asynchronously, and one action that
  halts the loop. → *Risk* if either is missing.

## Record

- **One state file, written last.** The between-tick state is one
  named file/table, and the tick writes it as its final act. → *Invalid*
  if two files both claim to be the state; *Risk* if the write isn't
  last (a crash leaves the tick unrecorded).
- **Append-only with an outcome vocabulary.** Each tick records one
  entry with a small closed set of outcomes (done / blocked / refused /
  reverted …). → *Risk* if free text only — stuckness becomes invisible.
- **Terminal sentinels are terminal.** If the file carries `STATUS:
  COMPLETE`-style markers and the driver greps for them, nothing may be
  appended after a terminal one. Entries after it mean the stop rule is
  tripped or ignored. → *Invalid*.
- **Archive rule.** A threshold and a destination for old entries.
  → *Risk* if absent and the file is read every tick.

## Re-arm / stop

- **Stop conditions are enumerated** (goal met, budget, N consecutive
  failures, no-progress, halt) and each has a mechanism. → *Risk* for
  each missing one; *Invalid* if the driver's exit code disagrees with
  the documented meaning (exits 0 while criteria remain FAIL).
- **Steady state is recognised.** A rule that lets the loop say "nothing
  to do" and stop early rather than fill the wake. → *Risk* if absent.
- **No-progress detection.** The same target N ticks running with no
  commit or no metric change triggers escalation. → *Risk* if absent.

## Documents and drift

- **Each rule has one canonical copy** in the file the loop actually
  loads; other mentions are one-line pointers. → *Redundant* for each
  extra full copy; *Invalid* when copies disagree.
- **Counts agree.** Number of loops / phases / agents named in
  `CLAUDE.md` equals the number defined in the loop playbook.
  → *Invalid* on mismatch.
- **References resolve.** Every path, script, command and agent named
  in the governing files exists. → *Invalid* per dead reference (unless
  documented as generated at runtime).
- **Superseded designs are gone or marked.** A router, driver or rule
  the playbook says was replaced must not still be described as current
  elsewhere. → *Invalid*.
- **Drivers don't swallow failure.** `|| true`, `2>/dev/null` on setup
  steps means a tick can start on a broken toolchain silently.
  → *Risk*.
- **Built vs declared is stated.** A contract "normative from Phase 1"
  that is only simulated must say so where it's declared normative.
  → *Invalid* if a reader would believe it is enforced.
