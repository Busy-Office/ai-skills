# Blast radius — order totals to integer cents

## What it does

Renames the `/orders` JSON field `total` (a float in units) to `totalCents` (an integer) and updates the web view. It is a wire-format change: everything that reads the JSON by field name is affected, not only callers of `serializeOrder`. The CLI dump writes the same objects to `out/orders.json`, so that file changes shape too.

## The one fact it is safe because of

"Only the web view reads `total`." I treated that as a hypothesis and tested it on the copy with the patch applied. It is false: level 4, Ran.

```
$ git apply change.patch && node --test
pass 2 fail 0
$ node src/cli/dump-orders.js && python3 scripts/nightly_export.py
KeyError: 'total'
```

## Risks

| risk | where | how it breaks | likely · cost | check |
|---|---|---|---|---|
| the nightly export stops | `scripts/nightly_export.py:9` reads `order["total"]` from the file `src/cli/dump-orders.js:7` writes | KeyError; the ledger feed gets no day total | certain · high | the two commands above |
| the test does not see it | `test/orders.test.js:8` counts keys | passes before and after the rename; not evidence the change is safe | certain · medium | a test on the field names |

## Cleared

| what | where | why |
|---|---|---|
| a function named `total` | `src/legacy/sum.js:2` | unrelated to the field |
| other readers of `out/orders.json` or of the field | none found | `grep -rn "total\|orders.json" .` found only the lines above |

## Before it lands

1. Run the consumer on the dump, which fails on the real bug today: `node src/cli/dump-orders.js && python3 scripts/nightly_export.py`.
2. Rename the key in `scripts/nightly_export.py:9` in the same change.

---
*Read 9 files and the patch · proof run on a copy · target repo untouched.*
