# Topologies — the six shapes and when each is earned

The shape of the graph is the largest lever on wall-clock and on cost. Pick
it by asking two questions: *what is independent?* and *which stage truly
needs everything before it?* Everything else is layout.

---

## The six shapes

| shape | use it when | what it costs | in code |
|---|---|---|---|
| **chain** | each step genuinely reads the previous step's output — nothing is independent | slowest possible run; one context holds everything; one stall halts all | sequential `await agent()` |
| **parallel fan-out** | N independent jobs and the *next* stage needs all N together | every job waits for the slowest before anything downstream starts | `await parallel(items.map((i) => () => agent(...)))` |
| **pipeline** | N independent items flowing through the same stages, no cross-item need | almost nothing — wall-clock is the slowest single-item chain | `await pipeline(items, stageA, stageB, ...)` — **the default** |
| **diamond** | breadth first, then one merged answer | exactly one barrier, at the merge, where it is earned | fan-out (or pipeline) → plain-JS reduce → one `agent()` synthesis |
| **conditional route** | the path depends on what a node found | one classification call before the branch | `agent()` with an enum schema → `if` / `switch` in code |
| **cycle** | the size of the job is unknown until you are inside it | runaway spend if it never converges | `while` with a dry counter and a `seen` Set — `cycles.md` |

Shapes compose. A diamond whose merge routes into one of two pipelines is
three shapes and one graph. Draw it, name each barrier, and the composition
reads itself.

---

## The barrier test

A barrier is any point where the script waits for a whole set before the
next stage sees any of it — `parallel()` between stages, or `await` on a
collection before a `map`. It is correct in exactly three situations:

| cross-item need | example |
|---|---|
| **dedupe or merge across the full set** before expensive downstream work | eight finders return overlapping bugs; verify each bug once, not eight times |
| **early exit on the total** | "zero findings → skip verification and synthesis entirely" |
| **the next prompt compares one item against the others** | "rank these by impact", "which of these contradict each other" |

Three things that feel like reasons and are not:

- *"I need to flatten / map / filter first."* Do it inside a stage:
  `pipeline(items, stageA, (r) => transform(r), stageB)`. No barrier.
- *"The stages are conceptually separate."* That is what `pipeline()`
  models. Separate is not synchronised.
- *"It's cleaner code."* Barrier latency is real: five finders where the
  slowest takes 3× the fastest means the four fast ones idle for two-thirds
  of the stage. Cleanliness does not pay that back.

**The smell (G6).** If you wrote

```js
const a = await parallel(...)
const b = a.filter(Boolean).map(transform)   // per-item, no cross-item read
const c = await parallel(b.map((x) => () => agent(...)))
```

the middle line did not need the barrier. Rewrite:

```js
const c = await pipeline(items,
  (i) => agent(findPrompt(i), { phase: 'Find', schema: FOUND }),
  (r) => (r ? transform(r) : null),
  (t) => (t ? agent(nextPrompt(t), { phase: 'Next', schema: NEXT }) : null))
```

Item three can be in the last stage while item one is still in the first.

---

## Routing

Judgement at the node, determinism on the edge:

```js
const { severity } = await agent(`Classify this diff's risk:\n${diff}`, {
  schema: { type: 'object', additionalProperties: false,
            properties: { severity: { type: 'string', enum: ['low', 'high'] } },
            required: ['severity'] },
})
const review = severity === 'high'
  ? await pipeline(files, (f) => agent(`Audit ${f}`, { schema: FINDINGS }))
  : await agent(`Quick review:\n${diff}`, { schema: FINDINGS })
```

The classification is the agent's. Which branch runs is the script's, and
the same classification takes the same branch every time. There is no
"skipped the audit today" — skipping would have to be written into the
graph, and it is not.

---

## The hybrid rule: scout inline, then orchestrate

You do not need to know the shape before the *task*, only before the
*orchestration step*. Find the work-list in the main context first —
`ls` the routes, grep the call sites, read the diff's file list — then hand
that list to the graph. A workflow that begins with an agent whose job is
"figure out what to do" has put the scouting on the most expensive seat and
made every downstream width unknowable.

---

## Pipeline mechanics worth remembering

- Each stage callback receives `(prevResult, originalItem, index)`. Use the
  second and third to label later stages without threading them through
  stage one's return.
- A stage that throws drops **that item** to `null` and skips its remaining
  stages; the other items continue. `.filter(Boolean)` the result.
- `parallel()` is the same: a thunk that throws resolves to `null`; the call
  itself never rejects.
- Per call, ≤ 4096 items. Concurrency is `min(16, CPUs − 2)` per workflow;
  the rest queue. A hundred items finish; a handful run at once —
  `cost-model.md` for what that does to the critical path.
