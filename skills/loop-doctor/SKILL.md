---
name: loop-doctor
description: Reviews — and, when asked, sets up — a project's autonomous, scheduled loop — the routine that wakes on a cadence (cron, launchd, a /loop interval, a cloud routine, a CI schedule, a driver script in a sleep loop, a tick counter), does work unattended, and re-arms. Draws how one tick works from the project's real files, scores the loop on ten dimensions (correctness, safety, reliability, cost, maintainability, understandability, observability, purpose, improvement, proportionality), finds redundant and contradictory rules across the governing files, finds invalid detail (dead references, tripped stop sentinels, competing drivers, unbounded state files, gates the actor can approve itself), and compares the loop against a complete loop concept — works through the roadmap, re-plans from intent when it runs dry, tries-verifies-adjusts until the work is right, challenges finished work against a cited bar, spends in proportion, and uses Jev (if present) for cheap decisions at fixed points. Prescribes what closes each finding; in setup mode writes the loop's rules and config after approval. Use whenever someone asks how their loop / tick / wake / orchestrator / routine works, wants it reviewed, scored, benchmarked, audited, simplified or made safer, says the loop is stuck, drifting, doing busywork or "doesn't stop", asks what a scheduled agent actually does each run, or wants to design a periodic autonomous loop and check it before turning it on.
---

# Loop Doctor

A scheduled loop runs when nobody is looking, and its design is never in
one file: scheduler → driver → skill → rules in `CLAUDE.md` → a
definition-of-done → a gate log → a state file. Each was written at a
different time, and they drift. The loop keeps running on whichever copy
it happens to read.

Loop-doctor has two modes. **Review** (the default) produces one artifact —
a review that is **diagram first, score second, rows third** — and costs the
project nothing. **Setup** (only when asked to set up, design or fix a loop)
walks through the few decisions the project must make and writes the loop's
rules and config as one diff, after approval. Both measure against
`references/loop-concept.md`, the complete loop: roadmap-driven, re-planning
from intent, try-verify-adjust until right, challenged at milestones against
a cited bar, spending in proportion, with Jev at fixed points when present.

```mermaid
flowchart LR
  A["inventory.mjs<br/>≤ 2 s · read-only"] --> B["map onto<br/>the tick"]
  B --> C["audit<br/>Invalid · Redundant · Risk"]
  C --> D["score<br/>8 × 0–5 → health"]
  D --> E["prescribe<br/>what closes a finding"]
  E --> F["review<br/>diagram · score · rows · do-next"]
  F -. only when asked .-> G["apply"]
```

## The guard-rail: no overhead on the project

The person calling loop-doctor is asking a question, not adopting a tool.
So:

- **Write nothing into the target repo** in review mode. The review goes to the
  scratchpad (and to a published page if that's how they read things). If
  they want it in the repo, they name the path and you write exactly that
  one file.
- **Run nothing of the project's.** No install, no build, no tests, no
  `refresh` command. Only `git log`/`git show`/`git status` and the
  inventory script.
- **Read bounded.** Governing files fully; state files by header, first
  screen and last screen — the inventory gives their line counts, and
  the count *is* the finding. Never read a queue or log end to end.
- **No subagents by default.** One context, one pass. The inventory
  already did the mechanical work.
- **Leave a receipt.** The review's footer says how many files were read,
  that no state file was read whole, and that the target repo is
  untouched — so the reader can see the cost.

## Workflow

### 1. Inventory

```bash
node <skill-dir>/scripts/inventory.mjs <repo-path> > <scratchpad>/loop-inventory.json
```

Triggers (cron, launchd, workflow `schedule:`, `/loop Nm`, cloud-routine
mentions), drivers, governing docs, loop skills/commands, agents, state
files with size and growth, the intent document and who references it,
queue sharpness, and the cheap checks: repeated sentences across files,
dangling references (dead vs moved), numbers that disagree for the same
phrase, terminal sentinels with entries after them, swallowed errors,
single-OS drivers. Under `concept`: a loop config file, Jev calls (from
the driver or a hook, or only in docs), verifier agents, kill-switch, cap,
inner-loop and challenge mentions, and milestone tags — the evidence for
step 5b. Read all of it. It is evidence, not conclusions.

No trigger, no driver, no loop docs → this project has no scheduled
loop. Say so in three lines and stop.

### 2. Map onto the tick

`references/tick-model.md`. Fill the eight nodes — trigger, wake, select,
act, verify, gate, record, re-arm/stop — with the project's real file
names and numbers. A node with two answers is a finding; a node with none
is usually the worse one. Answer the three questions once each: who owns
"done", where does state live between ticks, do human gates block or log.
Climb the empty-queue ladder (steady state → re-plan from intent as
proposals → bounded explore) and note which rungs exist.

State **built vs declared** in one sentence: what runs today, what the
documents describe in the present tense that is only planned, simulated
or dormant. In every real loop reviewed so far this was the sentence the
reader needed most.

### 3. Audit

`references/checklist.md` — every item says why it matters unattended and
how a miss is classified:

- **Invalid** — the loop does not do what its files say, or cannot.
- **Redundant** — the same rule in more than one place; name the copy the
  loop actually loads.
- **Risk** — nothing wrong yet; the design lets it go wrong silently.

One row per finding: id · what · where (file:line) · exact fix.
"Consider consolidating" is not a row.

If the loop has a queue, list the **ambiguous items** — acceptance
unstated, or judgement-worded (*improve, look at, consider, clean up*) — by
id and file:line, and hand them to `requeue`. Rewording them is its job.

### 4. Score

`references/scorecard.md`. Ten dimensions, 0–5 by the anchors, one-line
reason each citing a file or a number; mean → health label (`fit · watch
· treat · stop`; a 0 in safety caps at *treat*). The score summarises the
rows; a reader must be able to go from a score line to the rows behind it.

Score last, and score from the reason: write the one-line reason first,
count the Invalid ids in it, and apply the ceiling (one → ≤ 2, two or more
→ ≤ 1) before writing the number. Both gauntlet rounds so far drifted one
point high on exactly the dimensions whose reasons cited two Invalids.

### 5. Prescribe

`references/patterns.md`. Recommend only what closes a finding or a gap
from step 2, with its cost. Three habits kept beat twelve written down.

### 5b. Compare against the loop concept

`references/loop-concept.md` is the target. Go through its slots — roles,
Jev points, roadmap shape, inner loop, levels, milestone challenge and
bar, caps and share, doors, stops, escalation, config — and mark each
**present** (file:line), **missing** (where it should live) or
**contradicted** (two answers). Report only missing and contradicted; the
present ones show in the scores. List every **human-input point** (start
it, answer a blocking gate, clarify an item, refill the queue, notice it
is stuck, decide it is done) with what removes each. Then the concept's
rules the loop lacks, **worded for this project's files, paste-ready** for
the rules file the driver actually loads. Keep the principles: the human
leaves the critical path, not the decision; good, not just done — in
proportion.

### 6. Write the review

`references/report-template.md`, exactly: ≤ 60 words, the tick diagram
with real file names, files-by-role, the score block, the finding tables,
prescriptions, the concept comparison, do-next (≤ 5), footer receipt. Prose outside tables/diagrams/code ≤ 450 words in total (the
paste-ready rule is a code block and doesn't count). Then a terminal
summary of ≤ 8 lines: one sentence on the loop, the health label and
mean, findings by class, the first fix.

### 7. Apply — only when asked

Invalid and Redundant fixes you proposed, one commit per class, diff
shown first. Risk items and pattern adoption stay separate decisions:
they change how the loop behaves, and a loop's behaviour should never
change as a side effect of being looked at.

## Setup mode — only when asked

When someone asks to set up, design or rebuild their loop (not to review
it), after steps 1–2:

1. **Ask only what the files can't answer**, each with the concept's default
   as the recommendation: where the roadmap and intent live (if the
   inventory didn't find them), which kinds of work need which critique
   lenses, the per-item and per-week caps, the improvement share, the
   escalation channel, and whether Jev is available (`jev doctor`). At most
   seven questions; take "defaults" as an answer.
2. **Draft one diff**, written for this project's files: the concept's
   rules as a section of the rules file the driver loads (never a second
   copy); a `loop.config.json` with levels, caps, share, lenses, models,
   stops, halt file and channel; the role → agent mapping; the Jev calls
   at their fixed points, each with its fallback, if Jev is available.
3. **Show it and wait.** Write only after an explicit yes, as one commit.
   Never write the scheduler or driver entry — say which to use and why;
   where money and machines are involved, the person decides.
4. Then run review mode on the result, so the new loop gets the same score
   as any other.

## Judgement calls

**The copy that's loaded is the real one.** A rule in `CLAUDE.md`, a
`SKILL.md` and a `docs/*.md` is obeyed in whichever the driver puts in
context. Keep that one; turn the others into a one-line pointer.

**Sentinels are state, not history.** A stop rule that greps for
`STATUS: COMPLETE` works once. If the log continued past it, the stop
rule is broken *now*. Rank it above almost everything.

**Growth is a cost paid every tick.** A file read at wake charges its full
length to every run. Report lines and growth; if there's no archive rule,
propose one with a threshold.

**Two drivers is zero drivers.** Don't pick the winner; report that
precedence is undefined and propose the person choose.

**Absence of a stop is a finding; absence of a human is not.** Log-and-
continue is a legitimate design. It must then have an asynchronous
escalation channel and a kill switch — check for those instead.

**Intent is read, never written, by the loop.** Re-planning from intent
when the queue runs dry is the right rung — as gated proposals. A loop
that promotes its own proposals is writing its own mandate.

**Good, not just done — in proportion.** A loop with no challenge step
converges on "done"; one that challenges every item never finishes. Look for
the middle: one lens on standard items, a real review per milestone, a
written share and caps.

**The doer never moves the bar.** A loop that can rewrite an acceptance
line to pass will, eventually. Rank it with self-approval.

**Jev advises; code decides.** A Jev call that lives only in a skill is a
wish; one that replaces the verifier is a hole. Look for it in the driver
or a hook, with a fallback, and with its outcomes recorded.

**Explain before you judge.** If the diagram was hard to draw from the
files, say so once — that difficulty is itself a finding.

## Files

- `scripts/inventory.mjs` — discovery + cheap checks; `--self-test`.
- `references/tick-model.md` — the tick, the empty-queue ladder, the
  three questions.
- `references/checklist.md` — dimensions → checks, with the why.
- `references/scorecard.md` — anchors, health label, sharpness.
- `references/patterns.md` — prescriptions catalogue.
- `references/loop-concept.md` — the target: the complete loop, its roles,
  Jev points, inner loop, challenge, proportion, doors and stops, config,
  and paste-ready rules.
- `references/report-template.md` — the review, exactly.
- `evals/gauntlet/` — the bar this skill's output is graded against.

## Related

It hands off rather than repeats: ambiguous queue items to `requeue`; a
vague or missing intent to `sharpen-intent`; what the runs actually cost to
`loop-economist` (which also runs the concept's weekly cost pass); the
shape inside one tick to `graph-engineer`; every cheap judgement to `jev`.

Four siblings share this loop's subject and answer different questions:
`loop-economist` (what the runs actually cost and whether the right agent did
the work), `loop-atlas` (what the whole thing looks like, and who is on the
crew), `requeue` (what the loop should be fed next) and `sharpen-intent` (what
the whole thing is for). This skill judges the **design**: whether the tick is
sound, safe, and says one thing. When the files are fine but the runs are
expensive, it is the economist's question, not this one. And the shape of
the work *inside* one tick — how a job fans out across subagents, where the
verifier sits, whether a barrier is earned — is `graph-engineer`'s subject:
this skill reviews the loop around a run, that one the graph within it.
