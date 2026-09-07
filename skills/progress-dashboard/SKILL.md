---
name: progress-dashboard
description: Publishes a one-page stakeholder progress dashboard for any git project — where it stands, what's waiting on people, whether it's stalled — from whatever records the project keeps (ADRs, decision notes, design graphs, roadmaps, gates, backlogs, changelogs, PRs). Use whenever someone asks how a project is going, wants a status update or progress report, asks "where are we", "what's blocked", "what's waiting on me/us", "what's left", or wants an existing dashboard refreshed.
---

# Progress Dashboard

A project's real status is scattered: decisions in one place, phases in
another, sign-offs in a third, PRs on GitHub. This skill collapses that into
one page for a **stakeholder** — someone who needs the answer, not the
inventory. The first screen answers three things: where the project is, what
is waiting on a human, and whether it has stalled. Everything else is one
click away.

## Workflow

### 1. Collect

```bash
node <skill-dir>/scripts/collect.mjs <repo-path> > <scratchpad>/progress-state.json
```

Flags: `--fast` (local files only: no GitHub, no per-file git history, no
refresh command — ~0.2 s), `--no-gh` (skip GitHub only), `--profile`
(timings to stderr), `--json-only` (no stderr notes), `--self-test` (run
the fixtures instead of a repo).

The collector is read-only and runs out-of-process; it never touches the
target project's files, dependencies, build or git state. Full mode costs
about 0.2–0.4 s for local records plus ~1.5 s for GitHub. Use `--fast` for
a quick check (someone asks "where are we?" mid-session), full mode for the
published page.

The collector reads `.claude/progress.json` in the target repo if present
(see `references/manifest.md`), then shape-detects everything the manifest
doesn't pin. It never runs a command the manifest didn't declare. Output is
one JSON blob; read it whole before writing anything.

The floor is a git repo. If `warnings` says it isn't one, stop and say so.
If it is a git repo with no decision or roadmap records, publish a short
page from git and GitHub alone and say plainly what the project doesn't
record yet.

### 2. Judge

The collector is deterministic; the judgement is yours. From the JSON, form:

- **Headline** — a fixed skeleton, worded by you:
  `[current phase and what's left] ; [staleness verdict] with [N] items waiting on people.`
  Current phase is `phases[].current`. Verdict is `staleness.verdict`
  (active / quiet / stalled / dormant) — use the word.
- **Waiting on humans** — `humanItems`, already ranked blocks-first
  (phase exit → decision → review/other) then by age, grouped by `owner`.
  A PR that is green and unmerged is a human item; so is an open gate, an
  open question with an owner, an unchecked manual action.
- **Phases** — `phases[]` with criteria counts where the roadmap has exit
  criteria; where it doesn't, show status only. Never invent a percentage.
- **What's quietly wrong** — `notes.dataQuality`: vocabulary the collector
  couldn't map, a phase referenced but not defined, a decision file with no
  status. These go on the page. `notes.config` (declare X in the manifest)
  goes to the terminal, not the page.

Where the data supports a conclusion, state it. "P2 is one merge away" beats
a bar the reader has to interpret.

### 3. Publish

Load `artifact-design`, then write the page and publish with the Artifact
tool. Stable path: `<scratchpad>/<project>-progress.html`. If a dashboard for
this project already exists, find it with `action: "list"`, read it, and
publish with its `url` so the stakeholder's link keeps working.

### 4. Optionally mirror to Notion

If the manifest has a `notion` key, or the person asks for the status "in
Notion", update that page after publishing the artifact — don't create a
second source of truth. Use the Notion connector (`notion-fetch` the page,
then `notion-update-page`) and write only the first screen: the headline,
both stamps, "Waiting on humans" grouped by owner, and the phase list, each
as plain Notion blocks, followed by a link to the artifact for the full
page. Replace the previous mirror's content rather than appending, so the
Notion page always reads as the current state. If no `notion` key exists
and the person asks, create the page as a private draft, put its URL in the
manifest, and say where it lives.

## The page

Order and density are the design. First screen, always open:

1. **Masthead** — project, branch/sha, phase N of M; the headline; a two-line
   lede; both stamps (*generated at* and *last moved*, date and time, with
   the age in words).
2. **Waiting on humans** — grouped by owner, severity stripe by what it
   blocks, age on the right. Omit the section if empty; never show it hollow.
3. **Phases** — one row per phase, current one marked; criteria bar when
   criteria exist, status pill otherwise.

Collapsed under their heading with a count (native `<details>`, no script):

4. **Decisions** — tiles by canonical status; recent and unsettled rows;
   deliberate absences shown as decisions with replacement and reopen trigger.
5. **In flight** — PRs with CI state and what they relate to; issue counts.
6. **Momentum** — last 14 days from git log, changelog and session notes,
   newest first, each line tagged with its source; a one-line cadence note.
7. **Capabilities** — only when the manifest opts in: agents, skills,
   AGENTS.md, with "new since last release".
8. **Sources** — every source with how it was found (manifest / shape /
   origin / default), its shape, and when it last changed; then the
   data-quality notes.

An empty section is omitted, not collapsed. Semantic colour is for state
(good / warning / critical), separate from the accent.

## Judgement calls

- **Closed is closed.** Struck-through nodes, `Status: CLOSED`, checked
  boxes, superseded ADRs — respect them. A resolved item shown as pending
  is worse than one omitted.
- **Absence is a decision.** A `DA-` node or any record with a replacement
  and reopen trigger is deliberate. Present it under Decisions, never as a
  gap.
- **Generated files are renderings.** If the collector reports a source as
  generated (prime-cm style), show its generation date and don't claim it is
  fresher than that.
- **Numbers need a sentence.** "14 accepted, 3 proposed — two of them
  blocked on one question owned by the shareholder" is the page; "14 / 3" is
  not.
- **Thin data, short page.** A project with a roadmap and nothing else gets
  a masthead, phases, and sources. Say what isn't recorded yet.

## Fixtures

`fixtures/` holds one small repo per format family the detectors support
(prose ADR, frontmatter decision note, line-per-node design graph, markdown
table graph, phase headings with exit criteria, milestone table, generated
requirement roadmap, checkbox backlog, per-file sessions). `--self-test`
runs them all and fails loudly. Add a fixture before adding a detector.
