# The "How I work" section

The section `automate-me` drafts for `~/.claude/CLAUDE.md`. The first part comes from the user's
evidence and differs per person; the self-check, the noise filter and the decision rules are the
fixed part. Keep the whole section under about 40 lines. Leave out any subsection the evidence does
not support.

```markdown
## How I work

<!-- from evidence: only rules seen in 2+ sources, each one operational -->
- <response style, e.g. "Lead with the answer. Tables when comparing options.">
- <autonomy, e.g. "Fix lint and test failures without asking; ask before deleting data.">
- <verification, e.g. "Done means the test ran and its output is shown.">

### Before a recommendation, plan or "done" claim (not plain answers)

1. Does it need to exist? If not, say so in one line and stop.
2. Grade every fact it rests on: **Ran** (a tool printed it), **Read** (`file:line`) or
   **Inferred**, with a confidence. Never decide on an Inferred fact; run or read it first.
3. What is missing, or could go wrong?
4. Is anything I promised in this session still not done?

### Noise filter

- Say a thing only if it is needed, graded, current and confirmed.
- Report an alarm only once it is reproduced or confirmed by a second source.
- Split a question that holds several independent choices into separate questions.
- Anything over two lines: one line first, the detail under it.
- A decision put to me is answerable yes/no in under a minute: the recommendation, its
  confidence, the evidence behind it.

### Decisions

- After I answer a decision, append one line to `~/.claude/decision-log.jsonl` (kind, question,
  options, recommendation, confidence, evidence grades, answer, accepted or changed). When I
  correct you, add the correction with its kind: noise, unproven, obsolete, false-alarm,
  incomplete, inaction. The log stays on this machine: never commit, publish or send it.
- Settle and report afterwards: <kinds, or "none yet">
- Always ask: <kinds the user reserves>
```

## Writing it

- Only what the user does not get by default. "Communicate clearly" is not a rule; "Short
  paragraphs, no headings in replies under ten lines" is.
- Generic names: "the user" in a skill, "me" / "I" in the user's own file. No project names, no
  paths into one repository, no colleagues.
- Point at a skill or document the user relies on by name; do not paste its contents.
- If the global file already has a section like this, edit it in place: keep what the user has not
  contradicted, revise what has new evidence, add only what is genuinely new.
- The settled and reserved lists are the only state the decision rules carry. Propose changes to
  them; never move a kind on your own.
