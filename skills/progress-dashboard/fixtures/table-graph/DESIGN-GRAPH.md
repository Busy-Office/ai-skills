# Graph (cap 400 lines)

## PRINCIPLES
| ID | Principle | Status |
|---|---|---|
| PRN-01 | Keep it simple | **accepted** |

## OPEN QUESTIONS
| ID | Question | Owner | Blocks | Status |
|---|---|---|---|---|
| OQ-01 | Open question about retry policy | alice | P2 | answered |
| OQ-02 | Deferred billing — which provider? | bob | P3 | open |
| ~~OQ-03~~ | Old one | carol | — | closed |

## DELIBERATE ABSENCES
| ID | Absence | Replacement | Reopen when |
|---|---|---|---|
| DA-02 | No workflow engine | event handlers | >3 approvals |

## EDGES
- OQ-02 -> P3 — blocked
- ADR-04 -> P1 — previously blocked, now unblocked
