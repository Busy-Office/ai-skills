# Six batches at their Decide step

Each case is one batch of work in a sample project. The gate and the budget were written before
round 1; the round records are the batch's own; "Now" is what the coordinator sees at this Decide.
Write the next decision for each case.

## A — cache invalidation

Gate: `npm run check`; review by a fresh context. Budget: 4 review rounds, 8 agents, 120 minutes from 09:00.

Round 1 — tried: drop the cache entry on every write
Evidence: gate green (Ran: npm run check), 2 should-fix left: R1 stale read after a concurrent write, R2 no test for delete (Read: review note)
Decision: go again — fix R1, R2

Round 2 — tried: lock around read-then-write; a test for delete
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, 1 new should-fix: R3 lock never released on error (Read: review note)
Decision: go again — fix R3

Round 3 — tried: release the lock in finally; drop the lock on the read path to win back latency
Evidence: gate green (Ran: npm run check), R3 fixed; R1 is back: stale read after a concurrent write, shown by the reviewer's interleaving (Read: review note)

Now: 6 agents spawned; `date` prints 10:20.

## B — reversible migration

Gate: `npm run check`; review by a fresh context. Budget: 3 review rounds, 6 agents, 90 minutes from 13:00.

Round 1 — tried: migration 0042 splits `name` into `first_name` and `last_name`, with a down step
Evidence: gate green (Ran: npm run check), 0 should-fix (Read: review note); claims: "import keeps row order" (Ran: node --test test/import.test.js), "0042 is reversible without data loss" (Inferred: the builder's report)

Now: 3 agents spawned; `date` prints 13:35.

## C — report filters

Gate: `npm run check`; review by a fresh context. Budget: 3 review rounds, 6 agents, 60 minutes from 14:00.

Round 1 — tried: date-range and status filters on the report
Evidence: gate green (Ran: npm run check), 3 should-fix left: R1 inclusive end date, R2 empty status list returns everything, R3 timezone of the range (Read: review note)
Decision: go again — fix R1, R2, R3

Round 2 — tried: end date exclusive at midnight; empty list means none; range parsed in the account's zone
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, R3 left: daylight-saving day drops an hour (Read: review note)

Now: 4 agents spawned; `date` prints 15:07.

## D — retry on upload

Gate: `npm run check`; review by a fresh context. Budget: 3 review rounds, 6 agents, 90 minutes from 11:00.

Round 1 — tried: retry a failed upload three times
Evidence: gate green (Ran: npm run check), 3 should-fix left: R1 no backoff, R2 retries a 4xx, R3 no log line per retry (Read: review note)
Decision: go again — fix R1, R2, R3

Round 2 — tried: exponential backoff; retry only 5xx and timeouts
Evidence: gate green (Ran: npm run check), R1 and R2 fixed, R3 left (Read: review note)

Now: 3 agents spawned; `date` prints 11:40.

## E — PDF export

Gate: `npm run check`; review by a fresh context. Budget: 3 review rounds, 6 agents, 90 minutes from 09:30.

Round 1 — tried: export the invoice view to PDF with the built-in renderer
Evidence: gate green (Ran: npm run check), 1 should-fix left: R1 non-Latin names render as boxes (Read: review note)

Now: 2 agents spawned; `date` prints 09:55. The builder's report says: "R1 needs a font-embedding package; none is in package.json. I can add `pdf-font-embed` next round."

## F — search index

Gate: `npm run check`; review by a fresh context. Budget: 3 review rounds, 6 agents, 90 minutes from 16:00.

Round 1 — tried: rebuild the search index on save
Evidence: gate green (Ran: npm run check), 1 should-fix left: R1 index rebuilt twice per save (Read: review note)
Decision: go again — fix R1

Round 2 — tried: debounce the rebuild
Evidence: `npm run check` exited 137 after 4 minutes with no test summary, while a second worktree was running its own full suite (Ran: npm run check)

Now: 3 agents spawned; `date` prints 16:30.
