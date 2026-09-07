# busy-office ai-skills

Reusable [Claude Code](https://claude.com/claude-code) skills from Busy Office.
Each skill lives under `skills/<name>/` and is self-contained: a `SKILL.md`,
the scripts it needs, reference docs, and fixtures that double as regression
tests. MIT licensed.

## Install

Clone once, then symlink the skills you want into your personal skills
directory so this repo stays the single source of truth:

```bash
git clone https://github.com/Busy-Office/ai-skills.git ~/Projects/ai-skills
ln -s ~/Projects/ai-skills/skills/progress-dashboard ~/.claude/skills/progress-dashboard
```

Claude Code picks a skill up by its description — you rarely need to name it.
`/progress-dashboard` works when you want to be explicit.

## Skills

| skill | what it does | trigger phrases |
|---|---|---|
| [progress-dashboard](#progress-dashboard) | One-page stakeholder progress dashboard for any git project | "how is this project going", "where are we", "what's blocked", "what's waiting on me", "status update" |

---

## progress-dashboard

**What it answers:** where the project is, what is waiting on a human, and
whether it has stalled — on one page, first screen, for a stakeholder who
needs the answer rather than the inventory.

![Sample progress dashboard — headline verdict, waiting-on-humans grouped by owner, phase rows; detail sections collapsed below](docs/showcase/progress-dashboard.png)

*Sample on illustrative data. First screen: headline, "Waiting on humans",
phases. Decisions, in-flight PRs, momentum, capabilities and sources sit
collapsed beneath, one click away.*

### Usage

Ask in any session inside the project:

> how are we doing on this project?
> what's waiting on me?
> refresh the progress dashboard

Claude runs the collector, forms a judgement, and publishes an Artifact
(a private web page you can share). Re-running redeploys to the same URL.

Direct use of the collector:

```bash
node skills/progress-dashboard/scripts/collect.mjs <repo>            # full: local records + GitHub
node skills/progress-dashboard/scripts/collect.mjs <repo> --fast     # local files only, ~0.2 s
node skills/progress-dashboard/scripts/collect.mjs <repo> --profile  # timings to stderr
node skills/progress-dashboard/scripts/collect.mjs --self-test       # run the fixtures
```

### What it reads

No configuration needed. It detects the *shape* of what a project keeps,
not the filenames:

| axis | recognised shapes |
|---|---|
| decisions | prose ADRs with `## Status`; YAML-frontmatter decision notes; line-per-node design graphs (`ID TYPE \| title \| status`); typed markdown tables; decision-session YAML; a register table (`README.md`) that fills gaps |
| questions / gates | `OQ-` nodes; `## GATE-XX — title` + `Status: OPEN \| Owner:` blocks; gate tables; unchecked `MANUAL-ACTIONS.md` items; `BLOCKED ON OWNER` lines in generated status files |
| delivery | phase headings with `Exit:` criteria; milestone tables; generated requirement roadmaps (read as renderings, with their generation stamp); checkbox backlogs; open PRs with CI state; issues |
| momentum | git log; Keep-a-Changelog releases; per-file session notes; loop status lines |
| capabilities | `.claude/agents`, `.claude/skills`, `AGENTS.md` — only when a project opts in |

Statuses are normalised to a small canonical vocabulary
(`proposed · accepted · superseded · rejected · deferred`, `open · closed`,
`closed · current · next · planned`); anything unmapped is shown raw and
flagged on the page rather than guessed.

Per-project overrides go in `.claude/progress.json` in the target repo —
pin a source, opt into capabilities, set staleness thresholds, add
vocabulary, name a Notion page to mirror into. See
[`references/manifest.md`](skills/progress-dashboard/references/manifest.md).

### Performance and safety

The collector is **read-only and out-of-process**: it never touches the
target project's files, dependencies, build or git state. The one exception
is a `refresh` command the manifest explicitly declares (for generated
roadmaps), and `--fast` skips even that.

Measured on real repos (Apple Silicon, warm cache):

| repo | files scanned | `--fast` | local only (`--no-gh`) | full (with GitHub) |
|---|---|---|---|---|
| busy-office-erp | 653 | 129 ms | 195 ms | 2.0 s |
| propflow | 3 411 | 170 ms | 501 ms | 1.5 s |

GitHub queries (`gh issue list`, `gh pr list`) are ~90% of full-mode time.
Use `--fast` for a mid-session "where are we?"; full mode for the page you
publish.

### Notion mirror (optional)

Add `"notion": "<page url>"` to the manifest, or ask for the status "in
Notion". After publishing the artifact, Claude rewrites that Notion page
with the first screen (headline, stamps, waiting-on-humans, phases) and a
link to the full page — replacing, not appending, so the page always reads
as the current state.

---

## Conventions for this repo

- A skill never depends on a project's filenames when it can detect the
  *shape* of a record instead. Per-project overrides go in
  `.claude/<skill>.json` in the target repo, documented under the skill's
  `references/`.
- Every parser has a fixture under `fixtures/` and a `--self-test` flag that
  runs them all. Add a fixture before adding a detector.
- Every skill gets a showcase entry above: a screenshot in `docs/showcase/`,
  what it answers, how to trigger it, and what it reads.

## License

[MIT](LICENSE) © 2026 Busy Office
