# Reprioritisation — structure

The order first, the reasons beside it, the hygiene beneath. Prose outside
tables and code: **≤ 350 words**. A reader who stops after the first table
knows what the loop should do next and why.

```markdown
# Queue review — <project> · <N open items across M files>

<≤ 50 words: what the queue is anchored to, what is wrong with its current
order, and what the next tick should pick up.>

## Health of the queue

| | |
|---|---|
| open / done | N / M |
| acceptance stated | n of N (0.xx) |
| vague items | n |
| blocked | n · human-only n |
| duplicates / contradictions | n / n |
| anchored to | `<intent file>` — or **none found** |

## Proposed order — loop lane

| # | item | where | why this rank | ready? | lane |
|---|---|---|---|---|---|
| 1 | | file:line | unblocks 3 · intent §2 | yes | loop |
| 2 | | file:line | | sharpen first | loop, subloop |

Rank reason names the deciding factor from `ranking.md` — and when two
factors disagree, which one won.

## Leaves the loop's queue

| item | where | lane | the exact ask / blocker |
|---|---|---|---|
| | | human | one sentence a person can act on today |

## Sharpened — top items rewritten

| where | was | now |
|---|---|---|
| file:line | | object · test · bound |

## Hygiene

| id | class | what | where | proposal |
|---|---|---|---|---|
| H1 | duplicate \| contradiction \| ghost \| stale | | file:line (+ file:line) | keep / point / resolve / delete |

## Do next (≤ 5)

1. …

---
*Read <M> queue files and <N> items · no ranking applied to the repo ·
target repo untouched.*
```

## Terminal summary (≤ 8 lines)

The top three in order with a five-word reason each, what left the loop's
lane and why, the count sharpened, and the one hygiene item worth acting
on today.
