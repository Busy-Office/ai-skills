# Anatomy of an intent that can steer

An intent document earns its place by settling arguments an actor would
otherwise have to guess its way through. Six parts; a page at most.

| part | the question it settles | test that it is real |
|---|---|---|
| **Who** | whose day changes | a named person or role, not "users" |
| **The change** | what is different for them afterwards | stated as an outcome (*so that…*), not a thing built |
| **The bet** | why this is the way to get it | one sentence a reasonable person could disagree with |
| **The measure** | how you would know it worked | a number with a unit, or an observable event |
| **Non-goals** | what this is deliberately not | at least two, and at least one that is tempting |
| **Horizon** | by when the measure is checked | a date or a cadence |

Below that, at most **three objectives** — the outcomes this horizon buys
— and exactly **one key focus**: the objective the next few weeks belong
to. Everything else is explicitly waiting.

## Outcome vs output

The single most common defect. An output is a thing you build; an outcome
is what changes because it exists.

| output (what most intents say) | outcome (what steers) |
|---|---|
| Ship the export API and the dashboard | An analyst answers a new question in under 10 minutes without asking an engineer |
| Migrate to Postgres | A schema change reaches production the same day, with a rollback |
| Add SSO | A new team is using it the day they sign up, with no ticket |

An intent made of outputs cannot rank anything: every item on the queue
matches it equally, which is the same as matching nothing.

## The falsifier

Write the sentence that would prove the bet wrong: *"If analysts still
route every new question through an engineer after this ships, the bet was
wrong."* An intent with no falsifier cannot ever be reviewed, only
restated — and a loop reading it will keep finding it satisfied.

## Length and place

One page. One canonical file, named by whichever rules file the actor
actually loads (`CLAUDE.md`, `LOOPS.md`, the loop's `SKILL.md`). An intent
nothing points at is a diary entry: the collector reports exactly this as
`referencedBy`.

## What does not belong

- The roadmap. Intent is the *why*; the roadmap is the *what next*. When
  they live in one file, the roadmap wins every read.
- Feature lists, architecture, and tooling choices.
- Hedge words — *world-class, seamless, robust, empower, 10x*. Each one
  marks a place where a claim was avoided; the collector lists them, and
  every one is a rewrite prompt.
