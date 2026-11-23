# Correct — report code importing the db client

One class, seen twice; the check that was meant to stop it passed both times. Fixed with
architecture, backed by a check whose error names the fix.

## Classes

| class | times | evidence | level | why not higher |
|---|---|---|---|---|
| report code imports `src/db/client.js` | 2 | `edcb61c`, `d2e0d9b`, `memory/feedback-db-client.md:6` | architecture + check | the client folds into `src/db/orders.js`; the check names it for any new file |
| dates shown without a locale | 1 | `4e3223d` | none | seen once: not a class |

## Proof

```
$ git checkout -q d2e0d9b && node scripts/check-db-imports.mjs
db imports ok                                   # the old check, on the real mistake
$ git switch -q fix/db-client && git cherry-pick -n d2e0d9b && npm run check
src/report/pdf.js imports the db client; read orders through src/db/orders.js
exit 1
$ git reset -q --hard && npm run check
db imports ok · tests 1 pass
```

## Rule table

| rule | enforced by | change |
|---|---|---|
| Only `src/db/` talks to the database | `src/db/orders.js` owns the connection; `scripts/check-db-imports.mjs` | row updated |

---
*Work on branch `fix/db-client`, gate green · nothing pushed, no tag.*
