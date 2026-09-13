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
| clarity | 3 | 1 of 3 purpose/objective statements is an outcome ("an analyst can answer a question without waiting on an engineer", line 5); the other two are output-only ("Ship the export API and the dashboard", line 8) and one carries the hedge "world-class" (line 4) |
| falsifiability | 2 | one measurable statement exists ("under 10 minutes by Q3", line 9) but no sentence anywhere states what would prove the bet wrong |
| focus | 2 | 2 objectives, neither marked as the current one; nothing says which the next weeks belong to |
| boundaries | 3 | `hasNonGoals` true, one non-goal ("not building a BI suite", line 12) — plausibly tempting given the export/dashboard direction, but only one is named |
| canonicity | 0 | `referencedBy["intent.md"]` is empty — no rules file loads it, which caps the verdict at decorative regardless of the other five scores |
| traceability | 4 | 2 of 3 open backlog items share language with the intent (share 0.67, above the 0.4 floor) |

## Does the work trace back?

**2 of 3 open items** share language with the intent.

| untraced item | where | reading |
|---|---|---|
| Add SSO login with Okta | `docs/BACKLOG.md:4` | off-purpose — nothing in `intent.md` names security, access, or an enterprise buyer; the stated audience is "an analyst," and the stated change is speed of self-serve answers, not authentication |

## The draft

```markdown
# Intent

**For** an analyst on a data team, who today waits on an engineer to answer a new question.

**The change:** the analyst answers the question themselves, the same day, without opening a ticket.

**The bet:** a self-serve export and dashboard cut the wait to under 10 minutes, which is short enough that asking an engineer stops being the faster path.

**We will know it worked when** time-to-answer for a new question is under 10 minutes, **by Q3**.
**It was wrong if** TO DECIDE — no source states what would count as evidence the bet failed.

**Non-goals:** we are not building a BI suite. TO DECIDE — a second, tempting exclusion is not named anywhere in the sources.

## Objectives (this horizon)
1. Analysts self-serve exports and a dashboard instead of filing a ticket — measure: export API and dashboard shipped
2. Time-to-answer for a new question falls under 10 minutes — measure: minutes, by Q3

## Key focus — now
TO DECIDE — the sources name two objectives and do not say which one the next weeks belong to.

TO DECIDE — should `docs/BACKLOG.md`'s SSO item be read as off-purpose (drop/defer via `requeue`) or does it serve an audience this intent doesn't name yet?
```

## To decide (≤ 5 questions)

1. Which objective is the current focus: shipping export/dashboard, or hitting the 10-minute measure? — blocks: the key focus, and which in-flight work is justified right now
2. What would prove the bet wrong: analysts still filing tickets after Q3, or something else? — blocks: whether the verdict can ever be falsified
3. Is "Add SSO login with Okta" off-purpose, or does it serve a buyer/audience the intent should name (e.g. an enterprise customer)? — blocks: whether `requeue` should drop or keep that item
4. What's the second non-goal — the tempting thing (a BI feature, a new dashboard type, a data warehouse integration) someone on the team keeps proposing that this intent should explicitly rule out? — blocks: boundaries
5. Should `intent.md` become canonical by pointing `CLAUDE.md` at it, replacing or supplementing the current "read `docs/BACKLOG.md` and pick the top item" rule? — blocks: whether the sharpened draft ever gets loaded

## Do next (≤ 5)

1. Point `CLAUDE.md` at `intent.md` — one line — so the document an actor already reads leads to the one that states why.
2. Answer question 1 (current focus) so the key-focus line can be written.
3. Answer question 2 (falsifier) so the bet can be reviewed later instead of only restated.
4. Re-run `requeue` once question 3 is answered — the SSO item's lane depends on it.
5. Name a second non-goal (question 4) before treating the non-goals list as complete.

---
*Read 2 documents (`intent.md`, `docs/BACKLOG.md`) plus the target's `CLAUDE.md` · draft not written to the repo · target repo untouched.*
```

## Terminal summary

Purpose lives in `intent.md`; nothing loads it — the target's `CLAUDE.md`
points at `docs/BACKLOG.md` instead. Verdict: **decorative**, mean 2.3/5,
capped by canonicity 0. One defect matters most: an unloaded intent steers
nothing regardless of prose quality. 1 of 3 open backlog items (SSO) does
not trace and reads as off-purpose. Five questions are open, the sharpest
being which objective is the current focus and what would falsify the bet.
Do-next #1 (point `CLAUDE.md` at `intent.md`) is the step that makes every
other fix matter.
