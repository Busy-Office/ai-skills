# bad-gate

A gate someone would plausibly write first: "merge when KEV is confident".
Eleven lint rows' worth of planted defects, all mechanical, all found by
`kev.mjs lint`:

| id | where | planted |
|---|---|---|
| K2 | `verdict` | instruction is a bare sentence |
| K3 | `verdict` | `noul` with no true/false boundary |
| K4 | `verdict` | asks for a verdict ("safe") |
| K1 | `size` | two-option `choice`, no fallback, not declared exhaustive |
| K8 | `tone` | a question no rule reads |
| K7 | rule 2 | reads `tests_passed`, which no question produces |
| K7 | rule 3 | `then: "reject"` is not a declared action |
| K5 | `merge`, `review` | an irreversible action; an action that declares nothing |
| K6 | `unreachable` | fails open to the *lowest* rank — an outage merges |
| K9 | `mode` | `"on"` |

What the lint cannot say, and the review must: the gate's whole purpose is
the defect. No rewrite of the questions makes "merge" a gate action. The
repair is a different gate — review depth — with the merge left to the flow
that already owns it. And `size` is a line count: tier 0, not a question.
