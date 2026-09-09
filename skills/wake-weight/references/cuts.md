# The cuts

Each cut names what it removes from the wake, what it costs to make, and what
it risks. Prescribe only cuts whose saving you can put a number on, and never
more than the reader will actually make — three cuts kept beat nine listed.

Order matters: **cut what is dead, then what is elsewhere, then what is
sometimes needed.** Only after those three should anyone consider cutting what
the loop genuinely uses every tick.

---

## 1. Archive the finished (dead weight)

**What:** done items in a queue, resolved entries in a log, closed gates.
**Saving:** the done share of that file, exactly — the collector counts it.
**Cost:** one rule in the loop's record step, plus one move.
**Risk:** none, if the archive stays in the repo and the file says where it went.

```
When BACKLOG.md exceeds 500 lines, move every [x] item older than 30 days to
docs/archive/BACKLOG-<year>-<quarter>.md and leave a one-line pointer.
```

A loop that appends a line per tick and never archives has a file whose read
cost rises forever while its usefulness is constant. That is the clearest waste
this skill finds and the easiest to fix.

## 2. Read the tail, not the file (status logs)

**What:** a chronological record where only the recent entries inform the next
decision.
**Saving:** everything but the tail — usually 80–95% of the file.
**Cost:** one line in the rules: *"read the last 30 lines of LOOP-STATUS.md"*.
**Risk:** a rule that needed the whole history silently changes meaning. Check
what the rules actually ask of the record first; if any rule greps the whole
file for a sentinel, that rule must move to a separate small state file.

## 3. Split the state from the history

**What:** one file that carries both *where the loop is now* (a few lines that
change every tick) and *everything it has ever done*.
**Saving:** the history, from every wake.
**Cost:** two files instead of one, and a rules edit.
**Why it matters beyond tokens:** a small resume file makes the loop's current
position readable at a glance, which is worth more than the tokens.

## 4. Turn a duplicate into a pointer

**What:** the same rule stated in `CLAUDE.md`, a `SKILL.md` and a doc.
**Saving:** the copies, and the drift.
**Cost:** one edit per copy.
**Rule:** keep the copy in the file the actor actually loads at wake; the others
become one line pointing at it. See `loop-doctor` for finding these.

## 5. Load the map on demand

**What:** a design graph, architecture map or ADR index read at every wake but
consulted in a minority of ticks.
**Saving:** its whole weight on the ticks that never open it.
**Cost:** a rules change — *"when the task touches a decision, read the graph"*
— and the judgement of when that is.
**Risk:** the real one on this page. A map loaded every tick is often what keeps
the actor from re-deriving the codebase; cutting it can raise cost elsewhere.
Prescribe this only with the tool-calls-per-edit number beside it, and say what
you expect to happen to it.

### The condition that makes this cut safe

Cut a map from the wake only when **something answers the questions it was
answering** — a built index the actor can query on demand (graphify, a codebase
index, a semantic search). Then the map's whole weight leaves every tick and
nothing falls back to grepping.

Three checks before prescribing it, in this order:

1. **Is the index built?** The collector reports `queryTool.built`. A rule that
   says *"query before you grep"* pointing at an index nobody generated is
   worse than no rule at all: the actor greps anyway *and* the map stays in the
   wake, so the project pays twice and believes it is saving. On one real
   project the rules said exactly that at `CLAUDE.md:69` with no index anywhere
   in the tree.
2. **Is it refreshed on a trigger?** A derived index is a state file with the
   same failure mode as any other: it goes stale silently. Name what rebuilds
   it — a post-merge hook, a step in the tick — and where staleness would show.
3. **Does the rule name the query, not the tool?** *"Run `graphify query
   "<question>"` before reading more than three files"* is actionable;
   *"we use a knowledge graph"* is not.

**Order of operations:** build the index, prove a query answers a real question,
*then* cut the map — and re-measure tool-calls-per-edit in the next window. Doing
it the other way round removes the map on the promise of a tool nobody has run.

The prize is worth the care: on the project measured this month the map was
**69k of a 124k wake, 56% of everything a tick pays before it starts work**. It
is the largest single cut available anywhere in that project, and it is
unavailable until the index exists.

## 6. Summarise what is only skimmed

**What:** a long reference where the actor needs the shape, not the text.
**Saving:** most of it.
**Cost:** a generated summary that must be regenerated when the source changes —
a maintenance burden, and a new way to be out of date. Prescribe last, and only
with a regeneration trigger.

---

## What not to cut

- **The definition of done.** It is small and it is the thing that stops rework.
- **The intent.** Same reason, and the loop re-plans from it when the queue runs
  dry.
- **Anything whose absence turns into re-derivation.** A cut that saves 20k at
  wake and costs 40k in searching is a loss; `toolCallsPerEdit` from
  `loop-economist` is how you check.

## Stating a saving

Always as a pair: **per tick, and across the window**. "Archiving the backlog
saves ~34k a tick, ~1.8M across 54 ticks" is a decision someone can make.
"Reduces context bloat" is not.
