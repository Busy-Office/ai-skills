# Queue review — sample-app · 11 open items across 2 files

Ordered by when things were written down. One item blocks three others and sits
at rank 8; two human-only items are in the loop's lane, where they stall it.

## Health of the queue

| | |
|---|---|
| open / done | 11 / 14 |
| acceptance stated | 0.55 (6 of 11) |
| duplicates / contradictions | 1 / 1 |
| anchored to | `intent.md` |

## Proposed order — loop lane

| # | item | where | why this rank | ready | lane |
|---|---|---|---|---|---|
| 1 | Extract the row-shaping helper | `docs/BACKLOG.md:31` | unblocks 3 items | yes | loop |
| 2 | Ship the CSV export endpoint | `docs/BACKLOG.md:4` | intent §2 | yes | loop |
| 3 | Choose the job store | `docs/BACKLOG.md:18` | three approaches, costly wrong one | bar first | loop · gauntlet k=3 |

## Leaves the loop's queue

| item | where | lane | the exact ask |
|---|---|---|---|
| Wire Stripe billing | `docs/BACKLOG.md:6` | human | decide three plan tiers |

## Hygiene

| id | class | what | where | proposal |
|---|---|---|---|---|
| H1 | contradiction | done in one file, open in another | `docs/BACKLOG.md:5` · `docs/ROADMAP.md:4` | keep the open one; the code says it never shipped |
| H2 | duplicate | export item appears twice | `docs/BACKLOG.md:4` · `:11` | keep :4, make :11 a pointer |

## Do next

1. Move the helper extraction to rank 1.
2. Take the human item out of the loop's lane.
3. Resolve H1 from the code.

---
*Read 2 queue files and 25 items · ranking is a proposal · target repo untouched.*
