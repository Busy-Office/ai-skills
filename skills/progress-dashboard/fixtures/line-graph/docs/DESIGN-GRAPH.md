# DESIGN-GRAPH.md

## NODES

### Principles (PRN)
PRN-001 PRN | First principles over analogy | accepted | Derive from JTBD
PRN-002 PRN | Ship-to-scale | accepted | No re-platform

### Decisions (ADR)
ADR-120 ADR | Multi-tenant SaaS machinery | parked | reversed by ADR-124
ADR-124 ADR | One platform, one tenant | accepted | re-scope
~~ADR-090 ADR | Old thing | accepted | gone~~

### Deliberate absences (DA)
DA-01 DA | No workflow engine in core | accepted | event handlers | reopen if >3 multi-step approvals

### Open questions (OQ)
OQ-07 OQ | Retain audit rows 7y or 10y | Shareholder | ADR-017
~~OQ-03 OQ | Old question | Owner | ADR-010~~

### Tasks (TSK)
TSK-401 TSK | Wire LINE webhook in prod | NEEDS-HUMAN | needs console access
TSK-402 TSK | Refactor calendar | done | cycle 61

### More questions
OQ-009 OQ | Which PDPA consent copy? | open | Legal | ADR-130
OQ-010 OQ | Multi-currency? | parked | Owner | —
