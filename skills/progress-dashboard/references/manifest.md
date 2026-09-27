# `.claude/progress.json` — per-project manifest

Optional. The collector works without it by detecting the *shape* of the
records it finds; the manifest exists to pin sources the detector can't be
sure about, opt into the capability axis, and override thresholds. Every key
is optional. Paths are relative to the repo root and may be globs.

```json
{
  "project": "Busy Office ERP",
  "decisions": ["docs/decisions/ADR-*.md", "docs/decisions/session-*/decisions.yaml"],
  "questions": ["docs/decisions/session-*/decisions.yaml"],
  "gates": ["docs/HUMAN-GATES-LOG.md"],
  "roadmap": "ROADMAP.md",
  "refresh": "rg export --out docs/ROADMAP.md",
  "backlog": ["docs/BACKLOG.md"],
  "changelog": "CHANGELOG.md",
  "sessions": ["docs/decisions/session-*/**/*.md", "wiki/meta/*-session.md"],
  "manualActions": ["MANUAL-ACTIONS.md"],
  "capabilities": true,
  "github": "your-org/your-repo",
  "notion": "https://www.notion.so/<workspace>/<page-id>",
  "staleness": { "quietDays": 7, "stalledDays": 14 },
  "vocabulary": { "parked": "deferred", "shipped": "accepted" }
}
```

| key | meaning | when absent |
|---|---|---|
| `project` | display name | repo directory name |
| `decisions` | files/globs holding decision records (ADRs, DEC notes, design-graph nodes) | shape-detect under `docs/decisions`, `docs/adr`, `adr`, `ADRs`, `**/wiki/decisions`, `docs/DESIGN-GRAPH.md`, `DESIGN-GRAPH.md` |
| `questions` | files holding open questions (`OQ-` nodes, yaml `questions:`) | same files as `decisions` |
| `gates` | human sign-off logs | shape-detect `docs/HUMAN-GATES-LOG.md`, `GATES.md`, `docs/GATES.md` |
| `roadmap` | the phase/milestone file | shape-detect `ROADMAP.md`, `docs/ROADMAP.md`, `PROJECT-PLAN.md`, `PLAN.md` |
| `refresh` | command that regenerates a *generated* roadmap; run only if declared | never run anything |
| `backlog` | checkbox-style task lists | shape-detect `docs/BACKLOG.md`, `BACKLOG.md`, `*-BACKLOG.md` |
| `changelog` | release notes | `CHANGELOG.md` |
| `sessions` | session/loop notes for the momentum section | shape-detect `SESSIONS.md`, `**/session-*/**/*.md`, `**/*-session.md`, `LOOPS.md` |
| `manualActions` | human to-do files that surface under "waiting on humans" | `MANUAL-ACTIONS.md` |
| `capabilities` | include agents/skills/AGENTS.md inventory | `false` |
| `github` | `owner/repo` for issues/PRs | the `origin` remote |
| `notion` | Notion page URL to mirror the first screen into after each publish | no mirror |
| `staleness` | day thresholds for the headline verdict | quiet 7, stalled 14 |
| `vocabulary` | extra status → canonical mappings | built-in map only |
| `audience` | `"engineer"` or `"stakeholder"`: which page to build (see below) | `"engineer"`: the page and output above, unchanged |
| `title` | page title, e.g. `"Harbour Bookings — Project Status"` | the project name |
| `exitCriteria` | stakeholder mode: repo-relative path to the phase exit-criteria JSON (format B below). Not `gates`, which means human sign-off logs | no exit checks on the page |
| `activity` | stakeholder mode: `{ "quietDays": 14, "stalledDays": 30 }`, days since the latest milestone | quiet 14, stalled 30 |
| `plain` | stakeholder mode: the owner's plain wording, used verbatim (see below) | every item listed as wording pending |

`exitCriteria`, `activity` and `plain` are read only when `audience` is
`"stakeholder"`; set in engineer mode, they earn a config note and nothing
else.

## Canonical vocabulary

Decisions: `proposed · accepted · superseded · rejected · deferred`, plus the
node type `DA` (deliberate absence). Questions and gates: `open · closed`.
Phases/milestones: `closed · current · next · planned`. Backlog items:
`todo · doing · done · blocked`.

Built-in mappings (case-insensitive): `ratified→accepted`, `approved→accepted`,
`parked→deferred`, `postponed→deferred`, `deprecated→superseded`,
`draft→proposed`, `answered→closed`, `resolved→closed`, `signed→closed`,
`active→current`, `done→closed`, `verified→closed`. Anything else is
reported raw and listed as a data-quality note on the page.

## Staleness verdict

Computed from the last commit date and whether anything is waiting on a human:

| age | open human items | verdict |
|---|---|---|
| < quietDays | any | **active** |
| quietDays … stalledDays | any | **quiet** |
| > stalledDays | yes | **stalled** |
| > stalledDays | no | **dormant** |

## Stakeholder mode

```json
{
  "project": "Harbour Bookings",
  "audience": "stakeholder",
  "title": "Harbour Bookings — Project Status",
  "exitCriteria": "bench/scorecard.json",
  "activity": { "quietDays": 14, "stalledDays": 30 },
  "plain": {
    "phases":   { "phase1": "Let people hold a seat on a sailing and keep it until they pay." },
    "steps":    { "1.2": "Let unpaid holds lapse on their own" },
    "criteria": { "R2": "Holds lapsing on time" }
  }
}
```

The collector then adds a `stakeholder` block to its output: `title`,
`headline`, `journey`, `thisPhase` (steps, step counts, exit checks),
`milestones`, `decisions`, `activity`, `blockers`, `exitCriteria` (file,
loaded, error) and `wordingPending`. Every other key is as in engineer
mode, apart from two: `sources` gains the exit-criteria file, and `notes`
gains the stakeholder notes. When the stakeholder view finds the current
phase (from the exit criteria or a heading's state), it withdraws the
roadmap's "no phase status markers" note, which would contradict the page.

### `plain` — the glossary

| group | key | example |
|---|---|---|
| `phases` | the phase id from the exit-criteria file; `phase<number>` or the number alone also match | `"phase1"` |
| `steps` | `<phase number>.<step number>` | `"1.2"` |
| `criteria` | the exit-criteria row id | `"R2"` |

Values are one plain sentence (phases) or a plain name (steps, criteria),
printed verbatim. Every phase, every step of the current phase and every
exit-criteria row of the current phase not yet at target that has no entry
is listed in `stakeholder.wordingPending` for the terminal summary.

### Format B — the exit-criteria file

Written by the project's own tooling; version 1. It should be deterministic
(no timestamps, stable key order) so a `--check` can compare it.

```json
{
  "version": 1,
  "overall": 2.1,
  "phases": [
    {
      "id": "phase1", "number": 1, "title": "Booking core", "status": "current",
      "rows": [
        { "id": "R2", "title": "An unpaid hold expires on time", "level": 2, "target": 3, "atTarget": false, "note": "" }
      ],
      "manual": [ { "title": "The harbour master signed the capacity rules", "done": false } ]
    }
  ]
}
```

`status` is `met`, `current` or `not_met` (shown as done, now and next);
`note` is text, empty when there is none; `rows` and `manual` may be empty
lists. `overall` is read but not shown to stakeholders. A missing file, a
path that is a folder or cannot be read, invalid JSON, another version or
a wrong shape is a data-quality note
naming the first problems; the page then takes its phases from the roadmap
and shows no exit checks.

### Steps — the roadmap's work-items table

The current phase's section of the roadmap (`## Phase <n> — …`, up to the
next heading of the same level) holds a table whose first column is the
step number and which has a `Status` column. Each status is exactly one of
`done`, `in progress` or `not started` (any case). `done` means the step's
acceptance is met on main; a landed step whose acceptance is not yet met is
`in progress`. The step name comes from the `Item` (or `Step`, `Name`,
`Title`) column. Any other status is reported and counted as unknown.

```markdown
| # | Item | Acceptance | Status |
|---|---|---|---|
| 1 | Seat model and holds | R1 at 3 | done |
| 2 | Hold expiry job | R2 at 3 | in progress |
```

Without an exit-criteria file, phases come from the roadmap headings; a
heading may end with its state: `## Phase 1 — Booking core — current`
(`met`, `done`, `current`, `next`, `planned` and similar).

### Milestones, decisions, activity

- **Milestones** are the latest five dated `##` headings of the changelog:
  `## 2026-09-13 — heading`, `## [1.2.0] — 2026-09-02 (summary)`,
  `## 1.2.0 (2026-09-02)`. Undated headings (`Unreleased`) are skipped.
- **Decisions** are the latest five accepted ones, dated from their record
  (frontmatter `date`, `- Session:`), else, in full mode, from the commit
  that added the file.
- **Activity** counts days since the latest milestone, not the latest
  commit:

| days since the latest milestone | word |
|---|---|
| < quietDays | **Moving** |
| quietDays … stalledDays | **Quiet** |
| > stalledDays | **Stalled** |
| no dated changelog entry | none; a data-quality note says why |

- **Blockers** are candidates for items waiting on people that block the
  current phase: open gates, `BLOCKED ON OWNER` lines, needs-human graph
  nodes, and any open question whose "blocks" names the current phase. An
  item whose title or "blocks" names other phases but not the current one
  ("Phase 3: the regulator signs off the launch") is left out. The page
  shows the rest only where they block the current phase.
