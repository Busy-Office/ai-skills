# Blast radius

The change looks safe. It renames a field and updates the only caller, and the tests pass, so the
risk is low. It might affect other consumers, but none are known.

## Risks

| risk | notes |
|---|---|
| a mobile client may read total | consider checking with the mobile team |
| legacy total() | maybe affected |

## Before it lands

1. Run the tests again.
