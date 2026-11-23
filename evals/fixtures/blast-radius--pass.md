# Blast radius — orders total to integer cents

Unsafe as written: the nightly job reads the old field by name and stops with a KeyError.

## What it does

The `/orders` JSON field `total` (units, a float) becomes `totalCents` (an integer). That is a
wire-format change, so every reader of the JSON is in scope, not only callers of `serializeOrder`.

## The one fact it is safe because of

"Only the web view reads `total`." **Disproven, level 4 (Ran)**, on a copy with the patch applied:

```
$ git apply change.patch && node --test
ℹ pass 2  ℹ fail 0
$ node src/cli/dump-orders.js && python3 scripts/nightly_export.py
KeyError: 'total'
```

## Risks

| risk | where | how it breaks | likely · cost | check |
|---|---|---|---|---|
| nightly sum reads `total` | `scripts/nightly_export.py:9` | KeyError, no ledger feed | certain · high | the run above |

## Cleared

| what | where | why |
|---|---|---|
| a function named `total` | `src/legacy/sum.js:2` | unrelated to the field |
| other readers of `out/orders.json` | none found | `rg -n 'orders.json' .` |

## Before it lands

1. Rename the field in `scripts/nightly_export.py:9` in the same change.
2. Replace the key-count test (`test/orders.test.js:8`, blind to a rename) with one on the field names.

---
*Read 9 files and the patch · proof run on a copy · target repo untouched.*
