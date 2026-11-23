# The reply

What correct says after changing the repository. Prose outside tables and code: **≤ 300 words**.

````markdown
# Correct — <the mistake class>

<≤ 50 words: how many classes, how often each happened, and the level each was fixed at.>

## Classes

| class | times | evidence | level | why not higher |
|---|---|---|---|---|
| <what agents keep doing> | <2 or more> | `<sha>`, `<sha>`, `memory/<feedback>.md:<line>` | <level> | <why the level above did not work> |
| <a mistake seen once> | 1 | `<sha>` | none | seen once: not a class |

## Proof

```
$ git checkout -q <a commit where the mistake happened> && <the existing check>
<its output>
$ git cherry-pick -n <that commit> && <the gate's command>
<the failing output, naming the fix>
$ git reset -q --hard && <the gate's command>
<the passing output>
```

## Rule-table rows

| rule | enforced by | change |
|---|---|---|
| <the rule> | <the architecture, type, check or test> | added / updated / dropped |

---
*Work on branch `<branch>`, gate green · nothing pushed, no tag.*
````

- **Classes**: one row per class, seen twice or more, with its commits or `file:line` and the
  correction on record; a mistake seen once is a row marked not a class, or left out. `level` is
  architecture, types, check, test or prose; every level below architecture says why the higher
  ones did not work.
- **Proof**: failing first, through the gate's own command, on a real past mistake; then passing on
  the fixed tree; an existing check's run on the past mistake comes first.
- **Rule-table rows**: each rule with what enforces it, and whether the row was added, updated or
  dropped. Exceptions, when any, are listed here with their reason, expiry and approval.
- **Receipt**: the branch, the gate, and what was not done (pushed, tagged).
