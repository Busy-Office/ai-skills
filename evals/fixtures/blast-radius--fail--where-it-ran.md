# Blast radius — orders JSON: `total` becomes `totalCents`

Not safe as it stands: the nightly Python export reads `total` from the dumped JSON and crashes; the tests stay green.

## What it does

`serializeOrder` stops returning `total` (a decimal) and returns `totalCents` (an integer); the web view is updated to match. Not spelled out: the same object is the `/orders` response and the `out/orders.json` file that `npm run dump` writes for a job in another language.

## The one fact it is safe because of

"Every reader of a serialized order reads `totalCents`." **Proven, level 1 (Inferred)**, where it ran: nowhere, the diff updates the only caller.


## Risks

| risk | where | how it breaks | likely · cost | check |
|---|---|---|---|---|
| nightly export reads the old field | `scripts/nightly_export.py:9` | `KeyError: 'total'`; the ledger feed gets no day total | certain · high | the dump and export command above |
| the file the export reads is written from the same serializer | `src/cli/dump-orders.js:7` | `out/orders.json` changes shape with the endpoint, with no version | certain · high | `npm run -s dump && grep -c '"total"' out/orders.json` |
| the serializer test is blind to the change | `test/orders.test.js:8` | counts three keys, so a renamed key stays green | certain · medium | `npm test` passes on the patched copy, above |

## Cleared

| what | where | why |
|---|---|---|
| web order line | `src/web/orderView.js:6` | updated in the same patch; `test/orders.test.js:12` checks its output and passes |
| `total()` helper | `src/legacy/sum.js:2` | a function of the same name, not the field; nothing in `src/api` uses it |
| other readers of `.total` or `["total"]` | none found | `grep -rnE "\.total\b|\[.total.\]" src scripts test` |

## Before it lands

1. Add a test that runs `npm run -s dump && python3 scripts/nightly_export.py` and expects `3 orders, 116.49`.
2. Change `scripts/nightly_export.py:9` to sum `totalCents` and divide by 100, in the same change.
3. Make `test/orders.test.js:8` assert the key names, not their count.

---
*Read 8 files and the patch · proof run on a copy · target repo untouched.*
