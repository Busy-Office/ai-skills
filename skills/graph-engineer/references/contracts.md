# Contracts — what a node promises, what an edge carries

A node you cannot describe in one line of input and one line of output is a
node you cannot parallelise, verify, or swap. The contract is what makes the
graph a graph instead of a chain with hope in it.

---

## The node contract

One `agent()` call is one node. It has exactly three properties:

| property | rule | why |
|---|---|---|
| **one job** | the prompt asks for one thing, described in a sentence | two jobs in one node is a chain hiding inside a node — it cannot be tiered, verified or fanned out separately |
| **explicit input** | everything the node reads is in its prompt (or fetched by the node from a path the prompt names) | a subagent has no shared window; anything you assumed it "already knows" it does not know |
| **validated output** | `opts.schema` is set, so the node returns a shape, not prose | the next node consumes a field, not a paragraph; validation happens at the tool-call layer and the model retries on mismatch, so a bad return never reaches your code |

Without `schema`, `agent()` returns the final text as a string. That is fine
for a terminal synthesis whose reader is a person. It is never fine for a
node whose reader is another node.

### Schema rules

```js
const FINDING = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title:  { type: 'string' },
    file:   { type: 'string' },
    line:   { type: 'integer' },
    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['title', 'file', 'impact'],
}
```

- Root `type` is `'object'` with `properties`. Anything else throws at
  `agent()`.
- `required ⊆ properties`. A required key with no property is unsatisfiable
  and throws — the lint's **G12** catches the mismatch before the run does.
- `additionalProperties: false`. Otherwise the model pads the object with
  fields your code never reads and your tokens paid for.
- Enums for anything downstream code branches on. `severity: 'High'` versus
  `'high'` is a routing bug you find in production.
- Arrays of objects for lists — `{ type: 'array', items: FINDING }` — so a
  fan-in can `flatMap` without parsing.

### `agent()` returns null

On a user skip or a terminal API error after retries, `agent()` resolves to
`null`, not a throw. Every consumer of a node's output handles `null`:
`.filter(Boolean)` on collections, an `if (!r)` on a single call. A node
that assumes its upstream always returned is a node that crashes the run on
the one flaky agent.

---

## The edge contract

An edge is not "B after A". It is: **A produces this shape; B was built to
consume it.** Name the edge by the data, and two things follow:

- You can tell whether the edge is real. Apply the one test — *which
  variable crosses?* If no value leaves A's return and enters B's prompt,
  there is no edge, only the order you typed. Cut it; A and B are
  independent and can run at once.
- You can swap either end. As long as the shape holds, a different finder
  or a different synthesiser plugs in without touching the rest.

Write edges down as rows: `from · to · what crosses`. An edge whose *what
crosses* cell reads "the context" or "everything so far" is not an edge; it
is a chain node that has not been contracted yet.

---

## Plumbing is code

Most of what sits between two agents is not judgement. It is flatten,
dedupe, filter, group, count. That is the edge, the edge is plain JavaScript,
and plain JavaScript costs zero tokens and runs the same way every time.

```js
// flatten a fan-out's returns
const items = collected.flatMap((c) => c.items)

// dedupe on a stable key — a Map keeps the first of each
const unique = [...new Map(items.map((i) => [i.url, i])).values()]

// filter to what the next stage wants, count what you dropped
const high = unique.filter((i) => i.impact === 'high')
log(`kept ${high.length} of ${unique.length} (dropped ${unique.length - high.length} non-high)`)

// group for a per-bucket fan-out
const byFile = unique.reduce((g, i) => ((g[i.file] ??= []).push(i), g), {})
```

**The agent-as-plumbing smell (G7).** An `agent()` whose prompt opens with
*combine these*, *merge*, *flatten*, *dedupe*, *aggregate*, *collect*,
*gather* is paying rent on wiring. Ask what the node is deciding. If the
answer is "nothing, it is arranging", replace it with the three lines above.
Keep an agent at the merge only when the merge is a judgement — *rank by
impact*, *resolve which of these two contradicts the source* — and give it
the already-flattened, already-deduped list so it judges instead of
arranges.

---

## Legibility: label and phase

- `opts.label` — `research:${source.key}`, `verify:${f.file}`. The progress
  tree shows labels; a run of eighteen agents named `agent` is unreadable
  when one of them stalls.
- `opts.phase` — the group the node belongs to. Inside a `pipeline()` or
  `parallel()` stage callback use `opts.phase`, never a bare `phase()` call:
  `phase()` sets global display state and stage callbacks interleave, so the
  labels race (**G11**).
- `log()` — one line per stage boundary with the count that crossed it.
  Anything you drop, cap or skip is logged with its number (**G14**);
  silence reads as "covered everything".
