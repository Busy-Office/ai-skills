# Changelog

## 0.18.0 — 2026-11-23

Five more skills get a gauntlet, and graph-engineer's fan-out rule counts what is really in flight.

### Added

- **Gauntlets for `correct`, `blast-radius`, `improve-until-done`, `deploy-agents` and
  `automate-me`**: a bar (`evals/gauntlet/BAR.md`), an empty rounds table, `evals/evals.json`, a
  reply template (`references/report-template.md`, which each SKILL.md's reply points to), a
  `bar-check.mjs` spec that checks only what that template states, pass and fail fixtures (one pass
  fixture per skill is a reviewer's strong run reshaped to the template), and a small synthetic
  fixture whose README is the answer key. Each fixture plants cases a weak run gets wrong: an import check that passes on both
  real past mistakes (`correct`, built by `fixtures/repeat-offender/build.mjs`); a Python consumer
  outside the diff that a field rename breaks (`blast-radius`); a plateau, an Inferred claim, a
  minutes cap, a new package and a crashed gate beside a go-again control (`improve-until-done`);
  four agents at once, money on a cheap model, a brief with no stop and a subagent told to run the
  full suite beside a clean brief (`deploy-agents`); a one-session signal, a contradicted one, a
  reserved kind with a perfect record and a tripwire kind (`automate-me`). No round has been run.
- `evals/consistency.mjs` fails a gauntlet that is not wired: every `evals/gauntlet/` needs
  `BAR.md`, `ROUNDS.md`, `evals/evals.json` and a bar-check spec or its own `CRITIC.md`.
- `bar-check.mjs` specs can name their do-next heading, their receipt and its label, a row
  vocabulary for rows without ids, and accept a commit sha as a location; a spec with
  `doNextMax: 0` has no do-next.

### Changed

- graph-engineer lint **G16** counts agents in flight: a fan-out nested in another's callback
  multiplies by the enclosing widths (a wave of 3 × 3 refuters is 9), `.slice(0, N)` and
  `.slice(i, i + N)` count N instead of exempting any `.slice(`, `chunks.map(…)` is every wave at
  once (only a singular `wave`, `chunk` or `batch` counts as 3), and a `parallel()` result keeps its
  input's width, so `verification.md`'s judge panel no longer fires. Only a fan-out in a callback
  nests: one awaited in another's list expression has finished before the outer starts. A singular
  wave reads the size argument of the call its own `for … of` iterates (`waves(xs, 5)` is 5;
  `chunk(xs, CAP)` reads `const CAP = 5`), so two loops that reuse `wave` each count their own. The
  rule's comment names its known limits (a fan-out inside a helper function, a push-filled array).
  The lint's GOOD example keeps 3 in flight.
- graph-lint's `staticAgentEstimate` follows the same `.slice` and const widths; it is an upper
  bound (a filtered list counts at its input's width), and `estimateNote` says so.
- bar-check's do-next count (M6) counts the outermost list only, so a question's options are not
  items: automate-me's two questions of three options are 2, not 8.
- bar-check's lede (M2) counts prose only, not a section heading above the first table. Blast-radius
  M15 passes a fact written **unproven**, or graded `Ran` (the grade word, case-sensitive) with a
  proof block holding a `$ command` and its output; "where it ran" on an Inferred fact no longer
  passes.
- solo-flow's two-branch variant: landing on the shared `develop` needs the owner's yes to the tip
  shown, unless the repository's instructions authorise it.
- `evals/consistency.mjs` takes skill, playbook and reference names from `git ls-files`, like the
  files it reads, so an untracked skill directory no longer satisfies a reference.
- The shared critic's skill field names no list of skills, and it gains an answer-key field.

## 0.17.0 — 2026-11-23

The plugin gets one shape: a mode routes each task to a playbook, playbooks call tool skills, and
tool skills cite principles.

### Added

- **`busy-office-mode`** routes any multi-step task to one of twelve playbooks — feature, bug-fix,
  investigation, refactor, goal-run, loop-tick, grill, landing, plugin-release, session-pickup,
  pause-safely, figure-it-out — opens its steps as todos and names the skill each trigger calls. A
  repository overrides a playbook with a same-named file in its `.agents/playbooks/`. It holds the
  one map of the loop family's hand-offs.
- **Ten principle skills**, each the single source of a rule several skills repeated:
  prove-it-works, fresh-reviewer, encode-lessons-in-structure, guard-the-machine,
  decide-at-the-right-level, names-first, stop-on-a-rule, subtract-before-you-add,
  guard-the-context-window, write-nothing-unasked.
- **`how`** (parallel explorers, one synthesis), **`why`** (git, decision log, ADRs, notebook, code
  graph; empty sources recorded) and **`review`** (fresh reviewers on another model; findings
  grouped Act on, Consider, Noted, Dismissed).
- `evals/consistency.mjs` checks that every skill named exists: `busy-office:<x>` and
  `principle-<x>` in every file, a backticked hyphenated name in a SKILL.md, and every backticked
  name in `busy-office-mode` and its playbooks. It lists files with `git ls-files` and also fails on a
  backticked near-miss of a real skill name (edit distance 2 or less) in README, AGENTS, CHANGELOG
  and `skills/*/references/`.
- graph-engineer lint rule **G16**: a fan-out wider than 3, or of unknown width, with no visible
  waves. The references show the "waves of 3" pattern wherever they fan out.

### Changed

- The grade definitions, the fresh-reviewer rule, the stop rules, the agent and suite limits and the
  loop family's guard-rail block are gone from the skills that repeated them; each names its
  principle and keeps only what is particular to it.
- deploy-agents' standard batch is now the feature playbook; its Workflow script runs that
  playbook's Build to Fix rounds steps, with targeted checks only. The full suite stays with the
  coordinator, once per batch.
- The seven loop-family "Related" sections point to the map in `busy-office-mode`.
- At most 3 agents at once is also the default concurrency of a Workflow script; graph-engineer's
  `min(16, CPUs − 2)` applies only when the user opts in. Subagents never run the full suite.
- Landing on `main`, pushing it, and a release's fast-forward and tag wait for the owner's yes to
  the tip shown (solo-flow, landing, plugin-release, AGENTS.md), unless the repository authorises
  them. Squash and rebase come before the ask; if `main` moves after the yes, `git range-diff` must
  show the same change and the full suite runs again.

### Removed

- `app-icon-generator` leaves the plugin, to be installed on its own.
- loop-atlas's handoff to an `animated-svg` skill that nothing ships. The page's own SVG is the
  still; a video is a recording of the page.

## Earlier versions

- 0.16.0 (2026-11-23) — improve-until-done and deploy-agents; automate-me predicts before recommending.
- 0.15.0 (2026-11-21) — automate-me, correct and blast-radius, adapted from pstack (MIT).
- 0.14.0 (2026-11-21) — progress-dashboard refresh is opt-in, eval output redacted, honest README, squash landing in solo-flow.
- 0.13.0 (2026-09-27) — progress-dashboard stakeholder mode.
- 0.12.2 (2026-09-27) — keep_cases visible in jev doctor and jev report.
- 0.12.1 (2026-09-27) — loop-doctor fits real loops.
- 0.12.0 (2026-09-27) — jev loop judges, the loop concept, loop-doctor 0.3.
- 0.11.0 (2026-09-27) — jev allow --all; no default call cap.
- 0.10.0 (2026-09-26) — jev: typed second opinions from jev-ai.pro; kev-gate removed.
- 0.9.4 (2026-09-20) — kev-gate, a sub-second classifier in front of the loop's decisions.
- 0.9.3 (2026-09-14) — graph-engineer.
- 0.9.2 (2026-09-13) — solo-flow.
- 0.9.1 (2026-09-13) — loop-economist's runs.json read is bounded.
- 0.9.0 (2026-09-10) — twelve commits of instrument work.
- 0.8.0 (2026-09-10) — green-gate decommissioned; its load-bearing part folds into loop-economist.
- 0.7.0 (2026-09-09) — green-gate.
- 0.6.0 (2026-09-09) — wake-weight.
- 0.5.0 (2026-09-09) — loop-atlas.
- 0.4.0 (2026-09-09) — sharpen-intent.
- 0.3.0 (2026-09-09) — loop-economist and requeue.
- 0.2.0 (2026-09-08) — loop-doctor autonomy plan.
- 0.1.0 (2026-09-08) — progress-dashboard and loop-doctor, packaged as the busy-office plugin.
