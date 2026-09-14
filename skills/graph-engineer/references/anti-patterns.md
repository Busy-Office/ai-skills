# Anti-patterns — the lint catalogue, and what the lint cannot see

`scripts/graph-lint.mjs` emits one row per mechanical finding, keyed by the
ids below. Severity: **error** stops the script from running or resuming;
**warn** runs but wastes or misleads; **info** is worth a sentence. The
review closes every row — fixed, or named as a false positive with the
reason.

| id | name | sev | detects | why it matters | fix |
|---|---|---|---|---|---|
| G1 | meta-not-literal | error | `export const meta = {…}` missing, not first, or containing an identifier, call, spread or template | the harness reads `meta` before running the script; anything computed cannot be read | a pure literal with `name`, `description`, optional `phases` |
| G2 | typescript-syntax | error | `: string`, `interface`, `<T>` generics, `as const`, `import type` | scripts are plain JS; TS fails to parse | remove annotations; shapes live in schemas, not types |
| G3 | forbidden-call | error | `Date.now()`, `Math.random()`, argless `new Date()` | they break resume — a replayed call must produce the same value | pass timestamps via `args`; vary prompts by index; stamp results after the workflow returns |
| G4 | node-api | error | `import`, `require(`, `fs.`, `process.` | the script has no filesystem or Node runtime | agents read files; the script reads `args` |
| G5 | unfiltered-results | warn | a `parallel()` / `pipeline()` result mapped, spread or indexed with no `.filter(Boolean)` first | a thunk that threw is `null` in that array; `.items` on `null` crashes the run at the merge | `.filter(Boolean)` at the point of use |
| G6 | barrier-smell | warn | `await parallel(…)` → per-item transform → `await parallel(…)` with no cross-item read in between | the middle transform did not need everything at once; the barrier idles the fast items for the slowest | one `pipeline()` with the transform as a stage |
| G7 | agent-as-plumbing | warn | an `agent()` prompt opening *combine / merge / flatten / dedupe / concatenate / collect / aggregate / gather* | tokens spent arranging, not judging; nondeterministic where code is deterministic | `flatMap`, a `Map` on a key, `filter` — `contracts.md` |
| G8 | unbounded-cycle | warn | a `while`/`for(;;)` with no dry counter, round cap, `budget.total` guard or `break` | the loop that stops at the 1000-agent backstop has spent everything | a counter that reaches zero and a budget guard — `cycles.md` |
| G9 | dedupe-against-confirmed | warn | a loop filtering fresh items against the array it `push`es confirmed results into, with no `seen` Set | rejected findings are fresh again every round; the loop never runs dry | `seen.add` before verify; filter on `seen` |
| G10 | worktree-on-readonly | warn | `isolation: 'worktree'` on an agent whose prompt is review / audit / read / research / find / verify with no write verb | a worktree costs setup and disk per agent and buys nothing unless the agent writes files | drop it; keep it only on parallel writers |
| G11 | phase-inside-stage | warn | a bare `phase()` call inside a `pipeline()` or `parallel()` callback | `phase()` is global display state; stages interleave, labels race | `opts.phase` on the `agent()` call |
| G12 | schema-required-mismatch | error | a schema whose `required` names a key absent from `properties`, or whose root is not `type: 'object'` | unsatisfiable; `agent()` throws | `required ⊆ properties`; root object |
| G13 | no-return | warn | no top-level `return` | the workflow's result is `undefined`; the caller reads the journal to find out what happened | `return { … }` the artefact the caller needs |
| G14 | silent-cap | warn | `.slice(0, N)`, `.slice(-N)` or a top-N with no `log()` naming what was dropped | truncation reads as "covered everything" | `log(\`kept N of M\`)` at the cut |
| G15 | blanket-model-override | info | `model:` set on every, or nearly every, `agent()` | that is moving the graph to a tier, not tiering it | override the bounded nodes only — `cost-model.md` |

Read the rows as evidence. A G6 on a barrier that the review can defend
(a real cross-set dedupe the lint could not see because it lives in a
helper) is closed by saying so, once, with the line.

---

## What the lint cannot see

These need a reader. The review looks for each one and writes a row when it
finds it.

**Self-verification.** A finder whose prompt ends "then double-check your
answer" has no verifier. The check is the same context that made the claim;
it will justify, not refute. Row: *no verifier on edge X*; fix:
`verification.md`.

**A barrier earned by nothing.** The lint sees `parallel → transform →
parallel`. It does not see `await parallel` followed by a *synthesis agent*
whose prompt never compares items — it just concatenates them. That agent
did not need everything at once either; it needed each result as it came.
Ask of every barrier: *which line reads two items together?* No line, no
barrier.

**A cycle with no key.** `seen` exists and is filled with `b.desc`. Two
finders describe one bug two ways; the Set sees two; the loop never dries.
The key is `file:line:kind`, or whatever is stable for this domain.

**Fan-out over a list nobody scoped.** `files.map(...)` where `files` came
from an agent asked "list the relevant files". The width is now unknown
before the run, the estimate is fiction, and the scouting is on the most
expensive seat. Scout inline; pass the list in.

**A verifier on the wrong shape.** Three identical refuters on a finding
that fails in three distinct ways share the blind spot. Three lenses do
not. `verification.md`'s table.

**Width without a wave count.** A fan-out of 40 on a cap of 6 is seven
waves. The review that says "40 in parallel" has estimated a critical path
of one agent-time; the run will take seven.

**The merge that judges nothing.** One `agent()` at the diamond's point
whose prompt is "write the report from these" — fine, if the report needs
judgement. If it needs a table, the table is code.
