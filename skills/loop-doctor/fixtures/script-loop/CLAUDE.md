# Project
## The loop
Read docs/LOOP-STATUS.md first, then docs/BACKLOG.md; pick the first unblocked item. The loop never stops for a human: it logs the fail-closed reading it proceeded with and continues.
Budget: at most 6 agents per tick. Tick every 20 minutes.
Run the DoD: migrations must be additive-only; destructive migrations stop with NEEDS-HUMAN.
See docs/MISSING-FILE.md for the router.
