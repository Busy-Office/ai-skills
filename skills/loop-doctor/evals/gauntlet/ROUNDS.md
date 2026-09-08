# Gauntlet rounds — loop-doctor

One row per round, appended, never rewritten. Artifact cells are
repo-relative so a reader can open what was graded. Budget: three rounds;
if not PASS by round 3, stop and report the gap rather than lower the bar.

| round | date | artifact | target | critic | verdict | fixes taken | review tokens |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-08 | *held privately — target repo is private; not committed here* | a private ERP monorepo | fresh-context subagent, CRITIC.md | **PASS** — 14/14 criteria; diagram test 6/6; 7/7 Invalid cites exact; 247 prose words; inventory 0.23 s; repo untouched. Noted, not failing: understandability scored 3 with one Invalid cited (anchor says 2, Δ1). | none required | build 138.9k · critic 59.5k |
| 2 | 2026-09-08 | `rounds/r2-sample-app-LOOP-REVIEW.md` | `fixtures/script-loop` (sample-app, public) | fresh-context subagent, CRITIC.md | **PASS** — 14/14; diagram test 6/6; 6/6 Invalid cites exact; 300 prose words; inventory 0.09 s; fixture untouched. Noted, not failing: understandability and observability each cite two Invalids yet score 2 (ceiling 1); label unchanged. | SKILL.md step 4: score from the reason, apply ceiling before writing the number | build 84.1k · critic 57.8k |
| 3 | 2026-09-08 | `rounds/r3-sample-app-LOOP-REVIEW.md` | `fixtures/script-loop` (sample-app) · bar now includes S11 autonomy plan | fresh-context subagent, CRITIC.md | **FAIL** — 14/15; S11 failed: 2 of 10 human-input rows and 3 Risk rows cite an absence ("no file") instead of a file:line. Autonomy plan otherwise sound: real files, intent read-only, gate before one-way work, reversibility defined. Diagram 6/6; 9/9 Invalid cites exact; 323 words; 0.11 s; untouched. | report-template: "an absence still has a location" + "ordering is stated" rules | build 79.8k · critic 62.7k |
| 4 | 2026-09-08 | `rounds/r4-sample-app-LOOP-REVIEW.md` | `fixtures/script-loop` (sample-app) · bar incl. S11 | fresh-context subagent, CRITIC.md | **PASS** — 15/15; diagram 6/6; all 25 finding rows and all 9 human-input rows carry file:line (absences located where the rule should live); paste-ready ladder names real files, intent read-only, gate before one-way work, reversible defined; 318 words; 0.11 s; untouched. | none required | build 84.7k · critic 62.5k |
