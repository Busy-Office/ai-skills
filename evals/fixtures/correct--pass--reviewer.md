# Correct — report code importing the db client

One class, seen twice; fixed with architecture, backed by a check whose error names the fix.

## Classes

| class | times | evidence | level | why not higher |
|---|---|---|---|---|
| report code imports `src/db/client.js` directly | 2 | `edcb61c` (CSV export, `'../../db/client.js'`), `d2e0d9b` (PDF summary, `'../db/client.js'`), `memory/feedback-db-client.md` | architecture + check | the client's `query` moved into `src/db/orders.js`, its only consumer, and `src/db/client.js` is deleted, so the wrong import cannot resolve; a check backs it because a new file could recreate a client |
| the date-locale mistake | 1 | `4e3223d` | none | seen once: not a class |

The reply-length memory is a personal preference, not this repository's mistake.

## The proof

The existing check never enforced the rule:

```
$ git checkout -q d2e0d9b && npm run check
db imports ok
$ git checkout -q edcb61c && npm run check
db imports ok
```

The new one, on the real mistake re-applied to the work branch, then on the fixed tree:

```
$ git cherry-pick -n d2e0d9b && npm run check
src/report/pdf.js imports the db client; read orders through src/db/orders.js
exit 1
$ git reset -q --hard && npm run check
db imports ok
pass 1 fail 0
```

## Rule-table rows

| rule | enforced by | change |
|---|---|---|
| Only `src/db/` talks to the database (`AGENTS.md:9`) | the structure (`src/db/orders.js` owns the connection) and `scripts/check-db-imports.mjs` | updated |

---
*Work is on branch `fix/db-client` with the gate green. I did not push or tag; the repository has no remote.*
