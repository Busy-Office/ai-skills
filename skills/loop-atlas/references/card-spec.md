# The agent card

One card per agent, laid out like a collectible: a reader should be able
to pick the right one for a job from the card alone. The gimmick is the
layout; **every value on it is evidence**.

## Anatomy

```
┌─────────────────────────────────────────┐
│ NAME                     class · model  │   class: scout · planner · builder
│ ┌─────────────────────────────────────┐ │          · verifier · scribe
│ │  emblem (emoji or inline SVG)       │ │
│ └─────────────────────────────────────┘ │
│ "Good at: <one line, plain>"            │
│                                         │
│ ABILITIES                               │
│  ▸ <name> — <what it does> · cost <…>   │
│  ▸ <name> — <what it does> · cost <…>   │
│                                         │
│ REACH ████░ 4   PRECISION ███░░ 3       │
│ COST  ██░░░ 2   AUTONOMY  ████░ 4       │
│                                         │
│ SUMMON WHEN  <the trigger, one line>    │
│ WEAKNESS     <what it must not be given>│
│ HANDS OFF TO <agent / stage>            │
│                                         │
│ Seen: 12 summons · avg brief 40 words   │
│ Tools: Read · Grep · Glob               │
└─────────────────────────────────────────┘
```

## Rules for each field

**Name, class, model** — from the agent file's frontmatter. Class comes
from what the description actually says the agent does, not from its name:
`scout` (finds), `planner` (decides shape), `builder` (changes code),
`verifier` (checks someone else's work), `scribe` (records, reports,
publishes). An agent that claims three classes is a finding — say so on
the card in one line rather than picking one silently.

**Good at** — one line, plain, no adjectives that could describe any
agent. "Sweeps many files and returns only the conclusion" is good;
"powerful search capabilities" is not.

**Abilities** — 2–4, each with a *cost*: a fresh context, a token
ceiling, a wall-clock, or "one commit". An ability with no cost is
marketing. Draw them from the agent's own instructions — an ability the
file does not grant is not on the card.

**Stats** — 0–5 bars, and each must be defensible from something:

| stat | means | derive from |
|---|---|---|
| **reach** | how much ground one summon covers | tool grant (Glob/Grep/WebFetch = wide), whether it gets its own context |
| **precision** | how narrow and checkable its output is | whether the agent file states an output shape; observed avg brief length |
| **cost** | what a summon spends (**5 = expensive**, label it so) | model, whether it re-reads the codebase, observed sidechain tokens |
| **autonomy** | how far it goes without a human | tool grant (write access, Bash), whether its instructions end in a gate |

Where a stat cannot be derived, print `—`, not a guess. A deck of
invented numbers is worse than a deck with holes: people will route work
by them.

**Summon when** — the concrete trigger, in the caller's words: *"you need
every call site of X and you don't want the file dumps."*

**Weakness** — the real one, and every agent has one: what it must never
be handed. *"An item with no acceptance test"*, *"work it wrote itself"*,
*"anything requiring a credential"*. This field is what makes the deck
useful rather than decorative.

**Hands off to** — the next card or the next stage. Together these edges
must reconstruct the flow diagram; if a card hands off to nothing, it is
either the last stage or a dead end, and the page says which.

**Seen** — observed summons in the window, average brief length, top
tools used inside its sidechains. `Never summoned in <window>` is a fine
and interesting value: print it.

## The main actor gets a card too

The session itself is an agent — usually the most expensive one on the
page. Give it a card with its real model mix and its stats, or the deck
implies the work is done by subagents when most of it is not.

## Two cards worth adding when the evidence supports them

- **Undefined but summoned** — a `subagent_type` the runs used that no
  file defines (built-in, or from a plugin). Card it from what the runs
  show, marked *undefined here*; that gap is worth seeing.
- **The vacancy** — a class with no agent at all. Draw it as an empty
  slot: `VERIFIER — vacant`. A missing verifier is the most common
  vacancy and the most expensive one.

## Tone

Card-shaped, not cartoon. Flavour lives in the layout, the emblem and the
class name; the text stays literal enough that someone can route real
work with it. No invented lore, no levels, no evolution chains, no
mock-battle statistics.
