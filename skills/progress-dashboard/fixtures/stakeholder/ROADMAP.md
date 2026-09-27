# Harbour Bookings — Roadmap

A made-up ferry-booking service, used only as a fixture.

## Phases

| Phase | Delivers | Gate |
|---|---|---|
| 0 Groundwork | repository, contracts, spikes | `phase0` — **met** |
| 1 Booking core | seats, holds, a payment stub | `phase1` — **current** |
| 2 Payments | card payments, refunds | `phase2` |
| 3 Launch | public launch | `phase3` |

## Phase 0 — Groundwork — met

Exit: the repository builds from a clean checkout and the spikes are recorded.

## Phase 1 — Booking core — current

### Exit criteria — gate `phase1`

| Row | Criterion (level needed) | Now |
|---|---|---|
| R1 | A seat can be held and released (3) | 3 |
| R2 | An unpaid hold expires on time (3) | 2 |
| R3 | Checkout calls payments only through its contract (2) | 1 |
| R4 | The operator screen lists every sailing (3) | 3 |

### Work items, in order

| # | Item | Acceptance | Status |
|---|---|---|---|
| 1 | Seat model and holds (`SEAT-101`) | R1 at 3 | done |
| 2 | Hold expiry job | R2 at 3 | in progress |
| 3 | Payment stub behind the checkout contract | R3 at 2 | not started |
| 4 | Operator screen for sailings | R4 at 3 | **done** |

## Phase 2 — Payments

Card payments and refunds through the provider chosen in ADR-0003.

## Phase 3 — Launch

Public launch.
