# Output — the review, the draft, the questions

Two documents in one message: what is wrong with the intent today, and the
intent as it should read. Prose outside tables and code blocks: **≤ 350
words** (the draft is a code block and does not count).

```markdown
# Intent review — <project>

<≤ 50 words: where purpose is stated today, whether anything loads it,
and the one defect that stops it steering.>

## Where purpose is stated

| file | intent headings | outcome / output-only statements | measured | loaded by a rules file? |
|---|---|---|---|---|
| | | 2 / 7 | 1 | no |

**Canonical:** `<file>` — or **undecided**, and why.

## Score

**Verdict: <steering | usable | decorative | absent>** · mean <x.x> / 5

| dimension | score | why (one line, cites a statement or number) |
|---|---|---|
| clarity | n | |
| falsifiability | n | |
| focus | n | |
| boundaries | n | |
| canonicity | n | |
| traceability | n | |

## Does the work trace back?

**<n> of <N> open items** share language with the intent.

| untraced item | where | reading |
|---|---|---|
| | file:line | off-purpose \| intent is out of date \| wording only |

## The draft

```markdown
# Intent

**For** <named role>, who today <the friction, in their words>.

**The change:** <what they stop doing / start being able to do>.

**The bet:** <one arguable sentence>.

**We will know it worked when** <measure with a unit> by <horizon>.
**It was wrong if** <the falsifier>.

**Non-goals:** <two, one of them tempting>.

## Objectives (this horizon)
1. <outcome> — measure: <…>
2. <outcome> — measure: <…>
3. <outcome> — measure: <…>

## Key focus — now
**<the one objective the next weeks belong to>** · until <date or event>.
Everything else waits, on purpose.

TO DECIDE — <any question the sources could not answer, left as a question>
```

## To decide (≤ 5 questions)

1. <question with two options> — blocks: <what cannot be ranked until answered>

## Do next (≤ 5)

1. Put the draft at `<path>` and point `<rules file>` at it — one line.
2. …

---
*Read <N> documents · draft not written to the repo · target repo untouched.*
```

## Terminal summary (≤ 8 lines)

Where intent lives and whether anything loads it, the verdict and mean,
the one defect that matters, the count of untraced items, and the
questions that are blocking — nothing else.
