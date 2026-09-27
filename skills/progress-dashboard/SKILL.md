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

If the JSON has a `stakeholder` block, the manifest asked for the
plain-language page: follow **Stakeholder mode** below instead of the rest
of this step, **The page** and the "Thin data, short page" call. In that
mode no data-quality note and no source goes on the page.

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
Notion page always reads as the current state. In stakeholder mode the page
is short: mirror all six sections, under the same plain-language rules. If no `notion` key exists
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

## Stakeholder mode

When `.claude/progress.json` sets `"audience": "stakeholder"`, the page is
for someone who does not read code. The collector adds a `stakeholder`
block with everything already joined; build the page from it. Without that
key, nothing in this section applies and the page above is unchanged.

### The page, top to bottom

One short static page with nothing folded (no `<details>`) and no script.
Light and dark mode; it must read well on a phone. Title:
`stakeholder.title`.

1. **Headline** — from `stakeholder.headline`: "Phase 1 of 4: <plain phase
   sentence>" (`phase.number`, `phase.of`, `phase.plain`); "3 of 10 steps
   done" (`steps`); the activity word (`activity`); "updated <date>"
   (`updated`). Leave out any part that is `null` or has a total of 0:
   never "0 of 0 steps done". If `phase` is `null` and every journey state
   is `done`, say the project has finished its phases instead.
2. **The journey** — `stakeholder.journey`: every phase in order, marked
   done, now or next, each with its plain sentence. A state of `null` (the
   records do not say) reads "not recorded".
3. **This phase** — `thisPhase.steps`, each with its status (done, in
   progress, not started; a step whose status is `null` reads "status not
   recorded"). Then "exit checks: N of M at target" from
   `thisPhase.exitChecks` (`atTarget` of `total`) and one plain line on what
   that means: which checks are left, by their plain names, and any manual
   check not yet done (`manualOpen`). If `exitChecks` is `null`, leave the
   line out.
4. **Recent milestones** — `stakeholder.milestones` (up to five): the date
   and the heading rewritten in plain words.
5. **Key decisions** — `stakeholder.decisions` (up to five, latest
   accepted): the date and one plain sentence each on what was decided.
6. **Blockers** — only when `stakeholder.blockers` holds something waiting
   on a person that blocks the current phase. The collector has already
   dropped items that name only another phase; the rest are candidates, so
   judge each by its title and what it blocks. Otherwise leave the section
   out; never show an empty one.

### Plain-language rules

- **The glossary is used verbatim.** An item with `plain` is printed
  exactly as the owner wrote it.
- **No codes, ids or file names.** No commit ids, file names, ticket
  numbers, or codes like "D2", "ADR-0025" or "#113" anywhere on the page,
  including the milestone and decision lines you rewrite. The raw titles
  carry them; your wording drops them.
- **No entry, no code.** An item with `plain: null` gets a short plain
  rewording of its raw text on the page, and it goes on the *wording
  pending* list in the terminal summary to the owner:
  `stakeholder.wordingPending` (kind, key, raw text), plus anything else you
  had to reword. The key is what the owner adds under `plain` in the
  manifest.
- **Numbers need a sentence.** "2 of 4 exit checks at target: holds lapsing
  on time and the checkout contract are left" is the page; "2/4" is not.
- **Never invent a percentage.** No progress bar from step counts, no score
  out of 100. `exitCriteria.overall` is an engineering score and stays off
  this page.
- **Notes go to the terminal.** `notes.dataQuality` and `notes.config` (an
  invalid exit-criteria file, a step status the collector could not read,
  no dated changelog entry) are for the owner, not the stakeholder.
- **Thin data, short page.** A section with nothing in it is left out.
  There is no sources section: it would be file names.

### The activity word

`stakeholder.activity.word` counts days since the latest dated CHANGELOG
entry (a milestone), not the latest commit: **Moving** under `quietDays`
(default 14), **Quiet** up to and including `stalledDays` (default 30),
**Stalled** beyond. A project that commits every day but has shipped
nothing for five weeks is stalled to a stakeholder. With no dated entry
there is no word: leave it off the headline and say why in the terminal.
The engineer page keeps its `staleness` verdict.

### Publishing and the terminal summary

The same-URL rule holds: the stable path, and if a page for this project
already exists, find it with `action: "list"`, read it, and publish with its
`url` so the stakeholder's link keeps working. The terminal summary to the
owner gives the link, then wording pending, then the notes.

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
requirement roadmap, checkbox backlog, per-file sessions), plus stakeholder
mode with a valid exit-criteria file, an invalid one, and a folder named in
its place. `"$now"` in an `expect.json` pins the clock in local time, and
those fixtures run again at UTC+14 and UTC−12. `--self-test` runs them all,
checks in a scratch git repo that no file name reaches a shell, and fails
loudly.
Add a fixture before adding a detector.
