# Changelog

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
- `evals/consistency.mjs` checks that every skill a SKILL.md or playbook names exists.

### Changed

- The grade definitions, the fresh-reviewer rule, the stop rules, the agent and suite limits and the
  loop family's guard-rail block are gone from the skills that repeated them; each names its
  principle and keeps only what is particular to it.
- deploy-agents' standard batch is now the feature playbook; its Workflow script runs that
  playbook's steps 3–7.
- The seven loop-family "Related" sections point to the map in `busy-office-mode`.

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
