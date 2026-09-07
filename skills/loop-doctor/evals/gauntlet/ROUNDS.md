# Gauntlet rounds — loop-doctor

One row per round, appended, never rewritten. Artifact cells are
repo-relative so a reader can open what was graded. Budget: three rounds;
if not PASS by round 3, stop and report the gap rather than lower the bar.

| round | date | artifact | target | critic | verdict | fixes taken | review tokens |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-08 | *held privately — target repo is private; not committed here* | a private ERP monorepo | fresh-context subagent, CRITIC.md | **PASS** — 14/14 criteria; diagram test 6/6; 7/7 Invalid cites exact; 247 prose words; inventory 0.23 s; repo untouched. Noted, not failing: understandability scored 3 with one Invalid cited (anchor says 2, Δ1). | none required | build 138.9k · critic 59.5k |
| 2 | 2026-09-08 | `rounds/r2-sample-app-LOOP-REVIEW.md` | `fixtures/script-loop` (sample-app, public) | fresh-context subagent, CRITIC.md | **PASS** — 14/14; diagram test 6/6; 6/6 Invalid cites exact; 300 prose words; inventory 0.09 s; fixture untouched. Noted, not failing: understandability and observability each cite two Invalids yet score 2 (ceiling 1); label unchanged. | SKILL.md step 4: score from the reason, apply ceiling before writing the number | build 84.1k · critic 57.8k |
