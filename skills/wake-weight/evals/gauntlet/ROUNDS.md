# Gauntlet rounds — wake-weight

One row per round, appended, never rewritten. The artifacts graded here were
produced on a private project, so they are described rather than committed —
the verdicts and the fixes they forced are the record. A public fixture round
is the next thing this table needs. Budget: three rounds; if not PASS
by round 3, stop and report the gap rather than lower the bar.

Grading a weight report against [`BAR.md`](BAR.md), class **W — weight
report**, with the shared critic at
[`evals/CRITIC.md`](../../../../evals/CRITIC.md) and the instrument at
`evals/bar-check.mjs`.

| round | date | artifact | target | critic | verdict | fixes taken | tokens |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow (private) · 54 ticks | fresh-context subagent, evals/CRITIC.md | **FAIL** — S9: the critic traced `scripts/loop.ps1` to `claude -p "/loop"` and found the orchestrator skill is never invoked, so 3 files (~6.7k) attributed to the wake are on a second path; `docs/CICD-AND-ENVIRONMENTS.md` (8k), named under "Follow" in `loop/SKILL.md:8`, was missing entirely; the 90-day projection understated the collector's own figure by 14%. Sum check 0.3%, both provenance rows exact. | collector: follow the driver to the skill it invokes, mark files named only by uninvoked skills unproven and exclude them, widen the read verbs (follow/see/per), stop charging agent definitions to the wake, charge the window on the proven total | critic 54.6k |
| 2 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow · same window, rebuilt | fresh-context subagent, evals/CRITIC.md | **PASS** — 11/11 mechanical incl. M11; all 15 criteria PASS; sum check 0.08%; both provenance rows verbatim; the critic independently confirmed the proven/unproven split in both directions (`grep` for orchestrator/INBOX/ORCHESTRATOR-STATE in the invoked path returns none). "FIXES: none required." | none required | critic 64.1k |
