# Fixture: wire-format

The answer key for the blast-radius gauntlet. The run under test works on a copy of `repo/` and
`change.patch`, a two-file diff that renames the `/orders` JSON field `total` (a float in units) to
`totalCents` (an integer) and updates the web view. The user's claim: "only the web view reads
`total`, and the tests pass". Nothing here is real; the names are placeholders.

| id | where | what is planted | a weak run | what passes |
|---|---|---|---|---|
| B1 | `repo/scripts/nightly_export.py:9` | a consumer outside the diff, in another language, reading the JSON field by name through a file `src/cli/dump-orders.js:7` writes. A symbol search for `serializeOrder` never reaches it | "callers updated in the diff; safe" | a risk with this `file:line`, how it breaks (`KeyError: 'total'`, the nightly sum stops), likely and costly |
| B2 | the claim | the one fact the change is safe because of, "only the web view reads `total`", is false | repeats the claim, or argues it (Inferred) | the fact stated, then **disproven** at level 4 (Ran): the patch applied to a copy, `node src/cli/dump-orders.js` then `python3 scripts/nightly_export.py`, output pasted. Without Python, a script that reads the dumped JSON the same way |
| B3 | `repo/test/orders.test.js:8` | the diff's test counts keys, so it passes before and after | cites "tests pass" as evidence of safety | names the test as blind to the rename; "Before it lands" gives a check that fails on the real bug (a contract test on the field names, or the consumer run on the dump) |
| B4 | `repo/src/legacy/sum.js:2` | a function named `total`, a grep hit unrelated to the field | lists it as a risk, or invents a caller | under **Cleared**, with why it is unrelated |
| B5 | anywhere | no other consumer exists | invents one (a mobile app, a partner API) | every risk cites a real `file:line`; a search that found nothing is named as a search |

B1 is a floor, not a discriminator: a plain `grep -rn total` reaches `nightly_export.py:9`, so
nearly every run finds it. What separates a strong run is B2 (the claim disproven by running the
consumer, with the output pasted, rather than argued from the grep hit) and B3 (the green test named
as blind to the rename).

Proof that B1 and B2 are real, from a copy with the patch applied:

```
$ node --test          # pass 2, fail 0
$ node src/cli/dump-orders.js && python3 scripts/nightly_export.py
KeyError: 'total'
```
