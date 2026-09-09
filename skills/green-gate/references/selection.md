# Selecting what to run

The cheapest gate is the one that runs the right twenty tests. Selection is
what makes tiering possible, and it is approximate — say so in the report.

## The mapping, in order of confidence

1. **The test for the file.** `src/export/csv.ts` → `src/export/csv.test.ts`,
   or `tests/csv.test.ts`. Path convention, highest confidence.
2. **Tests that name the module.** A test whose text imports or mentions the
   changed file's stem. Cheap to compute with a grep, and right most of the
   time.
3. **The workspace's own suite.** For a change in `apps/liff`, that app's unit
   tests. Coarser, still far cheaper than the monorepo.
4. **Everything.** Only for changes to shared foundations — the build config,
   a root type, a lockfile, CI itself.

The collector does 1 and 2. It does **not** build an import graph, and the
report must not imply it did: a test that exercises the changed module through
three layers of indirection will be missed by a grep. Where correctness
matters more than speed — the one-way doors from `ledger.md` — do not rely on
selection at all.

## Unmapped changes are a finding

A changed file that maps to no test is a coverage gap. Two honest responses,
and the report picks one:

- the change is genuinely covered elsewhere (integration, e2e) — say where,
- or nothing covers it, and that goes on the queue as an item.

What it must never do is silently escalate to "run the whole suite", which
converts a coverage gap into a time cost and hides it.

## Escalation rules

Escalate beyond the selection when a change touches:

- **the build, the type root, the lockfile, CI config** → the full fast tier,
- **a schema or a migration** → the checks that guard it, unconditionally,
- **auth, money, or deletion paths** → their pinned checks, unconditionally,
- **more than ~15 files** → the workspace suite; at that size selection stops
  saving much and starts risking a miss.

## Reporting it

Always as a fraction: **"T1 ran 14 of 518 unit tests (0.03) and 0 of 284 e2e."**
That single line tells the reader whether the gate is proportionate, and it is
the number the rebalance moves over time.
