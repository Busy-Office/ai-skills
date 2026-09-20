# queue-triage — key

REFUSED on holdout (2026-09-20): 1 missed, 4 of 6 over-escalated. Kept as the worked example of a gate that passes the set it was tuned on and fails the one it was not. Do not enforce.

Tune 20: 18 correct, 0 missed, 2 over. Holdout 12: 7 correct, 1 missed, 4 over,
over-rate 0.67 → refuse. Sweep on holdout: −0.1 → 2 missed / 1 over; +0.1 →
0 missed / 5 over. No shift admits.

Kept out of `fixtures/queue-triage/` so that an agent asked to check the
holdout has to run it.
