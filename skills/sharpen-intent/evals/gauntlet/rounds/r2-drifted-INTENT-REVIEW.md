# Intent review — drifted (fixture)

Purpose is stated once, in `intent.md`. No rules file the actor actually
loads points at it — `CLAUDE.md` sends the actor straight to
`docs/BACKLOG.md` instead — so nothing an actor loads ever reads this
document. That is the one defect that stops it steering.

## Where purpose is stated

| file | intent headings | outcome / output-only statements | measured | loaded by a rules file? |
|---|---|---|---|---|
| intent.md | Intent, Purpose, Objectives, Non-goals | 1 / 2 | 1 | no |

**Canonical:** `intent.md` — the only source; canonical by elimination, not by being loaded.

## Score

**Verdict: decorative** · mean 2.3 / 5

| dimension | score | why (one line, cites a statement or number) |
|---|---|---|
| clarity | 3 | 1 of 4 purpose/objective statements is an outcome ("an analyst can answer a question without waiting on an engineer", line 5); two are output-only ("Ship the export API and the dashboard," line 8; "We build a world-class platform," line 4, which also carries the hedge "world-class") |
| falsifiability | 2 | one measurable statement exists ("under 10 minutes by Q3", line 9) but no sentence anywhere states what would prove the bet wrong |
| focus | 2 | 2 objectives (lines 8–9), neither marked as the current one; nothing says which the next weeks belong to |
| boundaries | 3 | `hasNonGoals` true, one non-goal ("not building a BI suite," line 12) — plausibly tempting given the export/dashboard direction, but only one is named |
| canonicity | 0 | `referencedBy["intent.md"]` is empty; `CLAUDE.md` points at `docs/BACKLOG.md` instead — no rules file loads it, capping the verdict at decorative |
| traceability | 4 | 2 of 3 open backlog items share language with the intent (share 0.67, above the 0.4 floor) |

## Does the work trace back?

**2 of 3 open items** share language with the intent.

| untraced item | where | reading |
|---|---|---|
| Add SSO login with Okta | `docs/BACKLOG.md:4` | off-purpose — nothing in `intent.md` names security, access, or an enterprise buyer; the stated audience is "an analyst," and the stated change is speed of self-serve answers, not authentication |

## The draft

```markdown
# Intent

**For** an analyst on a data team, who today waits on an engineer to answer a new question (intent.md:5).

**The change:** the analyst answers a new question without an engineer's involvement (intent.md:5 — "an analyst can answer a question without waiting on an engineer").

**The bet:** shipping the self-serve export API and dashboard (intent.md:8) is what removes the engineer from that loop (intent.md:5) — a reasonable person could instead bet that self-serve tooling ships but analysts keep asking anyway, out of habit or trust.

**We will know it worked when** an analyst answers a new question without engaging an engineer at all — an observable event, not the same signal as either objective's own measure below; objective 2's "under 10 minutes" is the speed component of this, not the headline itself — **by Q3** (intent.md:9, the only horizon in the sources).
**It was wrong if** analysts are still waiting on an engineer to answer new questions after the export API and dashboard have shipped (derived from combining intent.md:5's stated change with intent.md:8–9's shipped outputs and horizon — no source states a falsifier directly, so this is a constructed one, not a quoted one).

**Non-goals:** we are not building a BI suite (intent.md:12). TO DECIDE — a second, tempting exclusion is not named anywhere in the sources.

## Objectives (this horizon)
1. Analysts self-serve exports and a dashboard instead of waiting on an engineer — measure: export API and dashboard shipped (intent.md:8)
2. Time-to-answer for a new question falls under 10 minutes — measure: minutes, by Q3 (intent.md:9)

## Key focus — now
**Objective 1 (ship the export API and dashboard)** · until shipped, with Q3 as the outer backstop set by objective 2's horizon — attempted from the sources: objective 2's 10-minute measure is only reachable once analysts have self-serve tooling to hit it with, so the enabling objective is the one today's work belongs to. No source states this ordering explicitly; flag for confirmation.
Everything else waits, on purpose.
```

## To decide (≤ 5 questions)

1. Is objective 1 (export/dashboard) really the current focus, as inferred below, or is objective 2 worked in parallel? — blocks: the key-focus line
2. Does the constructed falsifier above hold, or does a different signal (ticket volume, a survey) count as proof the bet failed? — blocks: falsifiability
3. Is "Add SSO login with Okta" off-purpose, or does it serve an unnamed audience (e.g. an enterprise buyer)? — blocks: whether `requeue` drops or keeps it
4. What's the second, tempting non-goal a teammate keeps proposing (a BI feature, a data warehouse integration)? — blocks: boundaries
5. Should `intent.md` become canonical by pointing `CLAUDE.md` at it, in place of "read `docs/BACKLOG.md` and pick the top item"? — blocks: whether the draft ever gets loaded

## Do next (≤ 5)

1. Replace `intent.md`'s content with the draft above (the file still holds the hedged, output-only text scored here) and add one line to `CLAUDE.md` pointing at it — one step, not two.
2. Answer question 1 — the key-focus line is a derivation, not a source statement.
3. Answer question 2 — the falsifier is constructed, not quoted.
4. Re-run `requeue` once question 3 lands — the SSO item's lane depends on it.
5. Name a second non-goal before the list is complete.

---
*Read 2 documents (`intent.md`, `docs/BACKLOG.md`) plus the target's `CLAUDE.md` · draft not written to the repo · target repo untouched.*
```

## Terminal summary

Purpose lives in `intent.md`; nothing loads it — `CLAUDE.md` points at
`docs/BACKLOG.md` instead. Verdict: **decorative**, mean 2.3/5, capped by
canonicity 0. Change/bet clauses trace to intent.md:5/8/9, not invented
detail; the headline measure is an event distinct from objective 2's own
10-minute number. Falsifier and key focus carry attempted derivations,
not bare TO DECIDE. 1 of 3 backlog items (SSO) is off-purpose. Do-next #1
writes the draft into `intent.md` itself, not just a `CLAUDE.md` pointer.
