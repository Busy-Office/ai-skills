# Patterns that work

Observed in real scheduled loops. Each entry: the problem, the pattern,
what it costs to adopt. Recommend the ones that answer a finding; don't
prescribe the list.

## Ownership of "done"

**Fresh-context falsifier.** The verifier is a separate agent whose
stated objective is *defects found*, running read-only with no memory
of the build. Some loops additionally require it to run on a different
model tier than the author, and report a deletion ratio so "slop" is
measurable. *Solves:* builder grading its own work. *Cost:* one extra
agent per tick; a rubric to write.

**Default-FAIL gate criteria flipped only by evidence.** Every gate item
starts FAIL; it becomes PASS only when the record cites the test output,
commit sha or journal sequence that proves it. *Solves:* checkbox-by-
assertion. *Cost:* the gate file format; discipline in the verifier
prompt.

**Planted-defect check of the verifier.** One gate item exists only to
test that the falsifier catches a known-bad case. If it passes, the
verifier is broken. *Solves:* a verifier that rubber-stamps. *Cost:*
one fixture.

**Red-proved gates.** A gate isn't trusted until it has been watched to
fail on a deliberately bad input; a red-proof that comes back green is
presumed a broken injection. *Solves:* gates that pass because they
check nothing. *Cost:* one bad input per gate, kept.

**The actor cannot declare done.** Completion is machine-checked
against the whole package as it would be certified, never against the
last diff, and never on the actor's say-so. *Solves:* "done" drift.
*Cost:* a deterministic completion check.

## Selection

**Deterministic target: first failing scenario, else first failing gate
finding.** Scenarios start failing; the target is never the actor's
choice. *Solves:* busywork and cherry-picking. *Cost:* an ordered
scenario list kept current.

**Counter-based multiplexing with explicit tie-break.** One queue, one
tick; loop type chosen by counter ("every 3rd standardise, every 12th
roadmap review"), with "later rows win" stated. *Solves:* many loop
kinds without many triggers. *Cost:* the counter must live in the state
file.

**Roadmap loop as dispatcher.** The first thing every wake does is
triage new input into the roadmap; only then is one loop dispatched.
*Solves:* new asks bypassing prioritisation. *Cost:* a triage step per
wake.

**Explore only when the queue is empty; steady state is a valid
outcome.** The fallback when nothing is unblocked is bounded
exploration, and the loop is allowed to record "steady state, nothing
done" instead of filling the wake. *Solves:* manufactured work.
*Cost:* none — it's a permission.

**Re-plan from intent when the queue runs dry — as proposals.** Before
exploring, the loop reads the project's intent document and the current
roadmap, drafts the next slice (items or open questions, each citing
the intent clause it serves), and logs a human gate for the set. It
never edits intent and never accepts its own proposals; in a
log-and-continue design it may start the safest one on its fail-closed
reading. *Solves:* a loop that can only be renewed by a human noticing
the queue is empty; roadmaps that drift from purpose. *Cost:* an intent
document worth reading, and a proposal format in the roadmap.

**Periodic objective review.** On a counter ("every 24th wake"), the
loop re-reads intent against the roadmap regardless of queue state and
emits proposals/questions — retire items that serve nothing, surface
gaps. Observed as an "Objective" loop type. *Solves:* purpose drift on
long-running loops. *Cost:* one counter rule; the review must produce
gated proposals, not silent re-prioritisation.

## State and records

**One state file, read first and written last, with an archive sweep.**
Everything the next tick needs is in one named file; a threshold moves
old entries to an `-archive` sibling. *Solves:* unbounded wake cost.
*Cost:* the sweep rule and a place for the archive.

**Resume file separate from log.** A short `RESUME.md` (uncommitted
work, unrecorded decisions, toolchain traps) that is rewritten, next to
an append-only log that is not read on wake. *Solves:* re-reading
history every tick. *Cost:* two files instead of one, with clear roles.

**Append-only journal as the real state; everything else derived and
rebuildable.** Markdown or JSON records are the source; a SQLite index
or generated STATUS is a mirror that `verify-rebuild` can regenerate and
compare. *Solves:* two sources of truth. *Cost:* a rebuild script and a
test that it round-trips.

**Closed outcome vocabulary per tick.** `landed | released | logged |
triaged | refused | reverted` (or the project's own), recorded by a
script after every commit, with vague words ("shipped") explicitly
rejected. *Solves:* stuckness hidden in prose. *Cost:* one recording
command in the commit step.

**Sentinel discipline.** Terminal markers live in a resume/state file
that is rewritten, never in an append-only log. *Solves:* stop rules
tripped forever by an old line. *Cost:* moving the marker.

## Budgets and stopping

**Enumerated outcomes with a stop evaluator.** `green | stopped:budget |
stopped:no-progress | stopped:repeat-failure | stopped:scope |
stopped:policy | escalated | abandoned`, each with a rule that produces
it. *Solves:* loops that never conclude. *Cost:* the rules, and a
budget manager.

**Session budget in the gate file.** "≤ 10 sessions" is a gate item
counted from the journal; exhausting it reopens the requirement rather
than continuing. *Solves:* infinite retry. *Cost:* one counter.

**Change budget, lowerable never raisable.** Caps on files touched, new
dependencies, permissions, contract changes, migration class; a task
may lower them; raising needs an escalation answer. *Solves:* scope
creep inside a tick. *Cost:* a diff-size check.

**Agents-per-tick cap.** A hard number (e.g. ≤ 6) in the rule the tick
loads. *Solves:* runaway fan-out. *Cost:* none.

**One commit / one push per tick, green or reverted.** The tick never
hands a red tree to the next tick; it reverts itself. *Solves:*
cascading breakage. *Cost:* revert discipline in the driver.

## Human gates

**Log the fail-closed reading and continue.** When a decision is the
sponsor's, the loop records what it assumed and why, proceeds on the
safe reading, and the sponsor overrules asynchronously in the gate log.
*Solves:* unattended loops blocking forever. *Cost:* a gate log the
human actually reads; a rule that the top items must be visible to them.

**Escalation classes named once.** One-way doors, scope, money, legal,
destructive migrations, new env vars → stop-and-escalate. Named in the
loaded rule, referenced everywhere else. *Solves:* the same class worded
three ways. *Cost:* one consolidation.

**Kill switch and steer.** `halt` / `resume` / `steer` as operator
commands or a flag file the wake stage checks first. *Solves:* the only
way to stop being "edit the rules". *Cost:* one check at wake.

## Governance and drift

**Assumptions carry review dates.** Every assumption the loop operates
under has an expiry; an expired one becomes a gate. *Solves:* stale
premises. *Cost:* a date per assumption.

**Self-correcting documentation.** When a rule was found to be false,
the file says so in place ("this line previously claimed X, which never
existed") rather than silently rewriting. *Solves:* trust erosion.
*Cost:* none.

**Thin `CLAUDE.md`, one loaded playbook.** The rules the tick obeys
live in one place that is actually loaded; `CLAUDE.md` points to it in
one line. *Solves:* three renderings of the same ten rules. *Cost:* one
refactor; resisting the urge to restate.

**Playbook and archive.** The loop playbook holds current loops only;
settled essays, retired loops and idea backlogs move to an archive
file. *Solves:* 1,800-line playbooks. *Cost:* a sweep.
