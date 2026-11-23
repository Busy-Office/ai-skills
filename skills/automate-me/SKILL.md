---
name: automate-me
description: "Learns how the user works and decides, from their feedback memories across projects, a local decision log, patterns seen in two or more recent sessions and one or two multiple-choice questions, and drafts a short \"How I work\" section for the global ~/.claude/CLAUDE.md, written only after the user approves the diff. Use for \"automate me\" or \"learn how I work\". Not for a project's purpose or objectives (that is sharpen-intent) or one repository's rules."
disable-model-invocation: true
---

# Automate me

Turns how the user works and decides into a short section every session loads. The output is a
**"How I work"** section in the user's global `~/.claude/CLAUDE.md`, which Claude Code loads in every
project and session. Nothing is written until the user has seen and approved the diff.

The user runs this on purpose. It reads their own local data; none of it leaves the machine, and no
step sends it to an outside service.

## Flow

### 0. Check what is there

Read `~/.claude/CLAUDE.md`. If it already has a "How I work" section (or one doing the same job under
another heading), this is an **update**: step 3 reads only sessions since the file last changed,
step 4 asks what has changed or is missing, and step 6 edits the section in place.

### 1. Feedback memories, across all projects

Claude Code's auto-memory keeps per-project notes in `~/.claude/projects/*/memory/*.md`. Read the
ones whose frontmatter says `type: feedback`: they are corrections the user already made once. A
preference that appears in two or more projects is person-level. One that names a repository's
paths, tools or rules belongs to that repository.

Take the rule, not the story: no project names, file paths or people carry into the draft.

### 2. The decision log

Run `node scripts/decisions.mjs --reserve <kinds the user also keeps>` (default log
`~/.claude/decision-log.jsonl`). The schema, the default reserve list and the graduation thresholds
are in [references/decision-log.md](references/decision-log.md), the one place they are stated. A
missing log is normal on a first run; the section this skill writes starts one.

Scores come from the **prediction line** each decision points at, written by a fresh agent before
the recommendation, never from the recommendation.

- A kind with status `may-settle` may be **proposed** as "settle and report afterwards". Read its
  `tripwire` line first, and say it in the proposal when the prediction never differed from the
  recommendation.
- A kind already in the settled list that now reads `ask` goes back: propose removing it.
- A reserved kind never moves.
- A correction kind with `propose: true` becomes one proposed rule, written from its notes.

If the log is thin and the user wants history in it, offer `node scripts/backfill.mjs <session.jsonl>`
on sessions they name: it prints proposed decision lines (no prediction, so never scored) for them
to review, label and append themselves.

How much to trust a source of confidence (a second-opinion verdict, a test suite) is calibration,
not the user. It never becomes one of the user's rules.

### 3. Recent sessions, only for repeated signals

Transcripts are in `~/.claude/projects/<encoded-cwd>/*.jsonl`, the working directory with `/`
turned into `-`. Read the current workspace's by default; read other workspaces only if the user
asks for it. They hold private conversations from unrelated work.

For more than a handful, run Claude Code subagents in parallel over slices (for example the last
2–4 weeks in three slices; more slices run in waves of 3, `principle-guard-the-machine`), on a cheaper model: this is reading, not judgement. Give each the paths
and the signals; each returns a short list of patterns with evidence pointers. Signals worth hunting:

- response preferences: length, tone, format, "shorter" or "plainer" corrections
- autonomy: what the user lets an agent do unasked, and what they always want asked
- verification: what "done" means, what proof the user accepts
- delegation: subagents, models, parallelism
- process: worktrees, commits, landing, releases
- the corrections that recur (the six kinds in the decision log)

Keep a signal only if it shows up in **two or more sessions**. A lone signal is dropped.

### 4. Ask, once

Mining misses intent that has not come up yet. Ask **one or two** multiple-choice questions with
`AskUserQuestion`, 3–5 options each, each question carrying a recommended option. Never twenty. Good
first questions: which proposed rules to keep; which decision kinds are reserved for the user.

### 5. Sort: person or repository

| goes to | what |
|---|---|
| `~/.claude/CLAUDE.md` | how the user works and decides anywhere: style, autonomy, proof, the self-check, the noise filter, the decision rules |
| that repository's own instructions | anything naming one repo's paths, commands, branches or tools |

List the repository rules in the reply, each with its source. **Do not write them**: the user takes
them to that repository's `CLAUDE.md` or `AGENTS.md` when they choose.

### 6. Draft, show the diff, write on approval

Draft the section from [references/how-i-work.md](references/how-i-work.md). Its fixed parts are a
self-check before any recommendation, plan or "done" claim (not plain answers), a noise filter, and
the decision-log rules that keep this loop fed. Fill the rest from steps 1–4.

Show it as a unified diff against the current `~/.claude/CLAUDE.md`, in the shape of
`references/report-template.md`: the signals with their verdicts, the decision-log proposals, the
repository rules, the questions, then the diff. Take feedback; expect more than
one round; cut on every round. Write the file only after the user approves that exact diff. If the
user edits it, show the new diff before writing.

If the user has a skill-authoring skill (for example a skill-creator), it can review the prose; the
output here is a section of a rules file, not a skill.

## Guardrails

- **Don't overfit to one conversation.** A preference stated once and contradicted another time is
  noise. Two instances before it becomes a rule.
- **Operational, not clever.** Every line is something an agent can do or check. No metaphors, no
  restating other skills.
- **Reference, don't inline.** A skill or document the user relies on appears by name or path, not
  pasted.
- **Minimal sections.** A section exists only for a specific, non-default rule. "Communicate
  clearly" is not a section; "Lead with the answer; tables when comparing options" is.
- **Generic names.** "The user" in skills; in the user's own file, "me". No project names, no
  colleagues, no paths into one repository.
- **No forced symmetry.** No process rules worth writing down means no process subsection.

## Evaluation

The output is subjective. Check it with the user: does it read like them, did it miss anything, would
they answer yes to every line? Then write it.

## When not to use

- A task-specific skill, not working conventions: write that skill directly; no mining needed.
- One narrow workflow ("how I write commit messages"): a regular skill or one line in the
  repository's own instructions.
- A project's purpose, objectives or key focus: `sharpen-intent`.

---

Adapted from pstack's `automate-me` (MIT, © 2026 Lauren Tan; Claude Code port © 2026 Michael Denyer); see [NOTICE.md](../../NOTICE.md).
