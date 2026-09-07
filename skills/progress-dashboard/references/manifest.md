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
