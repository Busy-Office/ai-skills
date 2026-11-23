# The writeup

What blast-radius hands back. Prose outside tables and code: **≤ 350 words**, of which
**≤ 120** come before the proof block (the opening line, What it does and the fact).

````markdown
# Blast radius — <the change>

<≤ 25 words: safe or not, and the one consumer or fact that decides it.>

## What it does

<≤ 60 words: what changed, including the part the diff does not spell out (a wire format, a file
another program reads).>

## The one fact it is safe because of

"<the fact>." **<Proven | Disproven | unproven>, level <1–5> (<Ran | Read | Inferred>)**, <where it
ran: a copy, the scratchpad>:

```
$ <the command that runs the real code>
<what it printed>
```

## Risks

| risk | where | how it breaks | likely · cost | check |
|---|---|---|---|---|
| <reader of the old field> | `<file>:<line>` | <the failure> | <certain · high> | <the command above> |

## Cleared

| what | where | why |
|---|---|---|
| <a grep hit that is unrelated> | `<file>:<line>` | <why it is fine> |
| <other readers> | none found | `<the search that found nothing>` |

## Before it lands

1. <the cheapest check that fails on the real bug>
2. <the fix that goes in the same change>

---
*Read N files and the patch · proof run on a copy · target repo untouched.*
````

- **The one fact**: its level and grade on the first line under the heading; below level 4 it is
  written **unproven**. The proof block is what the command printed, not what it would print.
- **Risks**: one row per confirmed risk with a real `file:line`.
- **Cleared**: what was checked and found fine, with the reason; a search that found nothing names
  the search.
- **Before it lands**: ≤ 5 items.
