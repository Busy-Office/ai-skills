# Fixture: repeat-offender

The answer key for the correct gauntlet. `node build.mjs <out-dir>` builds `<out-dir>/repo`, a
seven-commit git repo on `main`, and `<out-dir>/memory/`, three memories standing in for the
workspace's feedback memories. The run under test works in the built repo; it does not read this
file. Every name is a placeholder.

History, oldest first: initial (orders, a report summary, an import check, a rule table); CSV
export imports the db client (mistake 1); fix routes it through `src/db/orders.js`; PDF summary
imports the db client (mistake 2); revert of the PDF summary; report dates without a locale (seen
once); fix pins the locale.

| id | where | what is planted | a weak run | what passes |
|---|---|---|---|---|
| K1 | commits "report: CSV export…" and "report: PDF summary line"; `memory/feedback-db-client.md` | one class seen twice: report code importing `src/db/client.js` | finds it once, or names it with no commits | one class, both commits named, the memory cited |
| K2 | `scripts/check-db-imports.mjs:10` · `AGENTS.md:9` | the existing check matches only `from "../db/client.js"` in double quotes, so it passes on both real mistakes (`'../../db/client.js'`, `'../db/client.js'`), while the rule table says it enforces the rule | trusts the rule table ("already enforced"), or proves a new check on a made-up example | runs the existing check at both mistake commits, pastes `db imports ok`, and calls the rule a repeat that nothing enforces |
| K3 | `src/db/client.js` | `query` has one consumer left, `src/db/orders.js`; architecture is available (fold the client into `src/db/`'s one owner so the wrong import cannot resolve), and so is a check whose error names `src/db/orders.js` | jumps to prose in `AGENTS.md`, or to a check with no word on why architecture did not do | the level picked, and for anything below architecture the reason it did not work (for example: relative imports cannot be made private in plain ES modules) |
| K4 | the proof | the new structure or check is shown failing on a real past mistake (a mistake commit checked out, or its import re-applied on a scratch branch) through `npm run check`, then passing on the fixed tree | pastes only the passing run, or runs the check script alone instead of the gate | both outputs pasted, failing first, run through `npm run check` |
| K5 | commits "report: show the order date" and its fix | a mistake seen once | makes it a class with a check | not a class (seen once), or not mentioned |
| K6 | `memory/feedback-replies.md` | a personal preference, not a mistake in this repo | adds it to the rule table | left out (it belongs to `automate-me`) |
| K7 | `AGENTS.md:9` | the rule table row names an enforcement that does not enforce | leaves the row as it is | the row names what now enforces the rule |
| K8 | landing | the repo has no remote | pushes, tags, or commits straight to `main` | a work branch, the gate green on it, nothing pushed |

Proof that K2 is real, from a fresh build:

```
$ git checkout -q <"report: CSV export…"> && node scripts/check-db-imports.mjs   # db imports ok, exit 0
$ git checkout -q <"report: PDF summary line"> && node scripts/check-db-imports.mjs   # db imports ok, exit 0
```
