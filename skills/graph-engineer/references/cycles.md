# Cycles — an edge back, and the guards that make it converge

Some jobs have no size until you are inside them: a bug sweep where each
bug reveals three more, a source list that grows as you read. That is a
cycle — a controlled edge back to an earlier node — and it is the one shape
that can spend your whole budget without producing anything.

A cycle is not a primitive. It is a `while` loop, a counter that reaches
zero, and a `Set`.

---

## Loop-until-dry — the reference form

Stop when K consecutive rounds surface nothing new.

```js
const key = (b) => `${b.file}:${b.line}:${b.kind}`   // stable, not the description text
const seen = new Set()
const confirmed = []
let dry = 0

while (dry < 2) {                                      // K = 2 empty rounds → stop
  const found = (await parallel(FINDERS.map((f) => () =>
    agent(f.prompt, { phase: 'Find', label: `find:${f.key}`, schema: BUGS }))))
    .filter(Boolean).flatMap((r) => r.bugs)

  const fresh = found.filter((b) => !seen.has(key(b)))  // dedupe against SEEN
  if (!fresh.length) { dry++; log(`round dry (${dry}/2)`); continue }
  dry = 0
  fresh.forEach((b) => seen.add(key(b)))               // add before verifying

  const judged = await parallel(fresh.map((b) => () =>  // verify only what is fresh
    parallel(['correctness', 'security', 'repro'].map((lens) => () =>
      agent(`Judge "${b.desc}" via the ${lens} lens. Real?`, { phase: 'Verify', schema: VERDICT })))
      .then((vs) => ({ b, real: vs.filter(Boolean).filter((v) => !v.refuted).length >= 2 }))))

  confirmed.push(...judged.filter((j) => j.real).map((j) => j.b))
  log(`round: ${fresh.length} fresh, ${confirmed.length} confirmed so far`)
}
return confirmed
```

Four lines carry the whole pattern:

| line | why it is there |
|---|---|
| `key(b)` on stable fields | two finders describe the same bug in different words; a key on `file:line:kind` sees one bug, a key on `desc` sees two and never runs dry |
| `!seen.has(key(b))` — **seen, not confirmed** | the finding a judge rejected last round is found again this round; deduped against `confirmed` it is fresh again, verified again, rejected again, forever. This is the line almost every first cycle gets wrong (**G9**) |
| `seen.add` before verify | a finding that fails verification is still *seen* — that is the whole point |
| verify only `fresh` | the confirmed set is not re-judged; each round's cost is proportional to what is new |

`dry` resets to zero on any fresh round. It counts consecutive empties, not
total empties.

---

## Loop-until-count — accumulate to a target

```js
const bugs = [], seen = new Set()
let rounds = 0
while (bugs.length < 10 && rounds < 6) {                // both guards
  const r = await agent('Find bugs not in this list:\n' + JSON.stringify(bugs), { schema: BUGS })
  for (const b of r?.bugs ?? []) if (!seen.has(key(b))) { seen.add(key(b)); bugs.push(b) }
  rounds++
  log(`${bugs.length}/10 after round ${rounds}`)
}
```

A count target alone is not a guard: a corpus with seven bugs never reaches
ten. Pair it with a round cap and say in the report which one stopped it.

---

## Loop-until-budget — scale depth to the user's "+500k"

```js
const found = []
while (budget.total && budget.remaining() > 50_000) {  // guard on budget.total
  const r = await agent('Find bugs in this codebase.', { schema: BUGS })
  if (r) found.push(...r.bugs)
  log(`${found.length} found, ${Math.round(budget.remaining() / 1000)}k remaining`)
}
```

`budget.total` is `null` when no target was set; then `remaining()` is
`Infinity` and the loop runs to the 1000-agent cap. The `budget.total &&`
guard is not optional. The target is a hard ceiling — once `spent()` reaches
it, `agent()` throws — so leave headroom for the synthesis that comes after
the loop.

---

## Convergence guards — every cycle has all of these

| guard | form | what it prevents |
|---|---|---|
| a counter that reaches zero | `dry < K`, `rounds < N` | the loop that never stops because "nothing new" never quite happens |
| a budget guard | `budget.total && budget.remaining() > headroom` | spending the synthesis's tokens on round nine |
| a key and a seen-set | `seen.has(key(x))` | rediscovery; the loop that pays to find the same dead end each round |
| a log per round | `log(fresh, confirmed, dry)` | a run that looks alive and is spinning |

**The 1000-agent lifetime cap is a backstop, not a design.** A cycle that
relies on it to stop has already spent everything it was going to. The lint
(**G8**) flags a `while` with none of the guards above; the review flags a
cycle with a guard that cannot fire.

---

## Each round must change the approach

A round that re-runs the same finders on the same input is not a round; it
is the same call billed again. Feed the round what changed: the `seen` keys
as an exclusion list, the last round's rejections as "not these", a
different lens or region per round. Three identical rounds returning the
same three findings is the evidence for a wider fan-out or a different
key, not for a fourth round.
