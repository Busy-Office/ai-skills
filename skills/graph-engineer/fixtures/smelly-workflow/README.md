# Fixture: smelly-workflow

`workflow.js` is a Workflow script that runs — `meta` is a pure literal,
the body is plain JS with a top-level `return` (valid in the workflow
sandbox; `node --check` rejects it, which is expected) — and plants eight
smells. A review must run `scripts/graph-lint.mjs` on it, name every id,
close each, and rewrite the script with the barriers it does not earn
removed.

| id  | line | what is planted |
|-----|------|-----------------|
| G3  | 30   | `Date.now()` — forbidden in a workflow script (breaks resume) |
| G14 | 31   | `args.files.slice(0, 20)` — a silent cap, no `log()` of what was dropped |
| G5  | 37   | `scanned.flatMap(...)` — `parallel()` result consumed without `.filter(Boolean)`; a null thunk throws here |
| G6  | 33–42 | `parallel` → per-item `.map` (line 39, no cross-item op) → `parallel` (line 40) — a barrier a pipeline would not need |
| G5  | 44   | `JSON.stringify(checked)` — the second `parallel()` result, also consumed unfiltered |
| G7  | 44   | `agent("Combine these results …")` — plumbing done by an agent |
| G8  | 47   | `while (true)` with no dry counter, budget guard, round cap or `break` |
| G9  | 52   | fresh filtered with `!confirmed.some(...)` — dedupe against confirmed, no `seen` Set; rejected findings return every round |
| G11 | 56   | `phase('Verify')` called inside a pipeline stage callback — races; should be `opts.phase` |

Not planted, and must not fire: G1 (meta is a literal and first), G2 (no
TypeScript), G4 (no Node API), G12 (schemas are sound), G13 (the script
returns). Nine rows in total; the lint reports G5 twice.

A correct rewrite: `items` → `pipeline(scan, verify)` with `opts.phase`,
`filter(Boolean)` on every barrier output, the merge as `flatMap` + a `Map`
keyed by `file:line`, the cycle bounded by `dry < 2` and
`budget.remaining()`, deduped against a `seen` Set, the cap either removed
or logged with the count dropped, and `started` passed in through `args`.
