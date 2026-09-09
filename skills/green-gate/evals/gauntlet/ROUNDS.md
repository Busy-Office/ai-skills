# Gauntlet rounds — green-gate

One row per round, appended, never rewritten. The artifacts graded here were
produced on a private project, so they are described rather than committed —
the verdicts and the fixes they forced are the record. A public fixture round
is the next thing this table needs. Budget: three rounds; if not PASS
by round 3, stop and report the gap rather than lower the bar.

Grading a gate design against [`BAR.md`](BAR.md), class **G — gate design**,
with the shared critic at [`evals/CRITIC.md`](../../../../evals/CRITIC.md) and
the instrument at `evals/bar-check.mjs`.

| round | date | artifact | target | critic | verdict | fixes taken | tokens |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow (private) · 205 test files, 15 checks | fresh-context subagent, evals/CRITIC.md | **FAIL** — G1: the collector maps 8 tests to the sample change and **4 are e2e**, so "T1 runs 8 of 205" described a tier the design forbids; 5 checks left unplaced; T0 had no degradation and T2's budget was literally "none". CI claims all verified accurate. | collector: split selection by kind and by tier. tiers.md: T0 degradation, T2 deadline + per-shard ceiling, state the rule even at zero instances. SKILL.md: state the run-everything cost with its cadence; place every discovered check | critic 61.0k |
| 2 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow · rebuilt | fresh-context subagent, evals/CRITIC.md | **FAIL** — S2: 2 of 15 checks still unplaced, and the critic found the hole they hid — T1 read "the touched workspace's `test`", but `services/api` and `packages/contracts` hold 88 of the 134 unit files and have no `test` script, so a change there had no tier running any unit suite. Also T0 double-counted a narrowing of T1's check (claimed split 2/5/8, actual 1/5/7) and T2's per-shard ceiling carried no number. | tiers.md: T1 falls back to the root suite when a change crosses workspaces or the workspace has no suite; a narrowing is not a placement; subsumption must be named; per-tier counts must sum. BAR: define "a check"; a budget carries a number even when untimed | critic 62.3k |
| 3 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow · rebuilt after r2 | fresh-context subagent, evals/CRITIC.md | **FAIL** — one finding, G1: the pinning line claimed "156 migrations reach prod by hand"; the real count is **42**. 156 counted three `.claude/worktrees/agent-*` copies — the same worktree duplication the artifact excludes from its own test counts, so it contradicted itself and overstated 3.7× the one figure justifying a demotion exemption. Everything else passed: 15/15 checks placed and summing, the workspace edge handled by name, every CI claim verified line by line. | collector: report one-way-door counts itself (migrations, auth, payments) with worktree and node_modules copies excluded, so the figure is never hand-counted. bar-check: cross-check the migration count as a headline figure. BAR: widen G1 to *every* countable repo figure, copies excluded; require same-tier subsumption to be named | critic 68.4k |
