# Gauntlet rounds — loop-economist

One row per round, appended, never rewritten. The artifacts graded here were
produced on a private project, so they are described rather than committed —
the verdicts and the fixes they forced are the record. A public fixture round
is the next thing this table needs. Artifact cells are repo-relative
so a reader can open what was graded. Budget: three rounds; if not PASS by
round 3, stop and report the gap rather than lower the bar.

Grading a run review against [`BAR.md`](BAR.md), class **E — economic review**, with the shared
critic at [`evals/CRITIC.md`](../../../../evals/CRITIC.md) and the instrument
at `evals/bar-check.mjs`.

| round | date | artifact | target | critic | verdict | fixes taken | tokens |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow (private) · 30 d, 94 commits, 2 sessions | fresh-context subagent, evals/CRITIC.md | **FAIL** — 14 mechanical PASS but E1 failed: the window holds 94 commits, not 95, so tokens-per-commit was 293k where 296k is right; the mean was printed 2.7 where 4+3+3+3+2+2 ÷ 6 = 2.8; the caps were never named. Every citation the critic sampled (6) verified exactly. | SKILL.md: write the review from one collection and verify it with `bar-check --collector`; show the mean's arithmetic; name every cap including those that do not bind. bar-check gained M10 (caps named) and M11 (headline figures diffed against a fresh collector run) | critic 62.2k |
| 2 | 2026-09-09 | *held privately — target repo is private; not committed here* | propflow · same window, rebuilt from one collection | fresh-context subagent, evals/CRITIC.md | **PASS** — 14/14 mechanical incl. M10/M11; all 16 criteria PASS; critic independently reproduced tokens/commit, the mean, the budget-table sum (0.4% off billable), per-agent figures, churn counts and both thrash sessions; 6 citations opened, all exact; target repo untouched | none required | critic 63.4k |
