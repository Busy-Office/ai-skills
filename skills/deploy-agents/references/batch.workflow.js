export const meta = {
  name: 'standard-batch',
  description: 'Build one batch in an existing worktree, verify its claims, review it fresh, fix in bounded rounds, then run the final check alone',
  whenToUse: 'One batch of the deploy-agents standard batch, after the user opted in to a workflow. Trial on one batch first; compare tokens with the manual way.',
  phases: [
    { title: 'Build', detail: 'one builder in the worktree' },
    { title: 'Verify', detail: 'a cheap agent re-runs every claim' },
    { title: 'Review', detail: 'a fresh reviewer, another model' },
    { title: 'Fix', detail: 'a fresh fixer per round' },
    { title: 'Final', detail: 'the full check, alone' },
  ],
}

// args, filled by the coordinator from the brief (deploy-agents/SKILL.md):
// {
//   goal, worktree, branch,          // the worktree already exists; every agent works in it
//   dontTouch: [...],                // paths and actions out of bounds
//   decisions: '...',                // the user's decisions, verbatim
//   testCommands: [...],             // targeted checks the builder and fixer may run
//   finalCheck: '...',               // the full suite: run once, alone, at the end
//   buildModel, reviewModel,         // the reviewer must differ from the builder
//   maxRounds: 3,                    // review rounds (improve-until-done budget)
// }
// Sequential by design: one agent touches the worktree at a time, so no
// isolation option and no two test suites at once.

const CLAIMS = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          grade: { type: 'string', enum: ['Ran', 'Read', 'Inferred'] },
          check: { type: 'string', description: 'the command or file:line that shows it' },
        },
        required: ['claim', 'grade', 'check'],
      },
    },
  },
  required: ['summary', 'claims'],
}

const VERIFIED = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { claim: { type: 'string' }, held: { type: 'boolean' }, evidence: { type: 'string' } },
        required: ['claim', 'held', 'evidence'],
      },
    },
  },
  required: ['results'],
}

const REVIEW = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'reuse the id of a listed earlier finding when it is the same problem' },
          severity: { type: 'string', enum: ['should-fix', 'nice-to-have'] },
          where: { type: 'string' },
          problem: { type: 'string' },
        },
        required: ['id', 'severity', 'where', 'problem'],
      },
    },
  },
  required: ['findings'],
}

const FINAL = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, tail: { type: 'string', description: 'last lines of the output' } },
  required: ['passed', 'tail'],
}

const a = args
const maxRounds = Math.min(a.maxRounds ?? 3, 3)
const rules = [
  `Work only in ${a.worktree} on branch ${a.branch}. Never push, merge or land.`,
  `Do not touch: ${(a.dontTouch ?? []).join('; ') || 'nothing listed'}.`,
  `The user's decisions, verbatim:\n${a.decisions}`,
  `Targeted checks you may run: ${(a.testCommands ?? []).join(' | ')}. Never run the full suite (${a.finalCheck}); it runs once at the end.`,
  'Grade every claim Ran (a tool printed it), Read (file:line) or Inferred.',
].join('\n')

// verifier on the edge: no claim reaches the reviewer or the coordinator unchecked
const verify = (claims, round) => agent(
  `In ${a.worktree}, re-run or re-read each claim's check and say whether it held. Report what the tool printed, briefly.\n${JSON.stringify(claims)}`,
  { phase: 'Verify', label: `verify r${round}`, schema: VERIFIED, effort: 'low' },
)

phase('Build')
const built = await agent(`Goal: ${a.goal}\n${rules}\nBuild it and commit on the branch. Return your claims.`,
  { label: 'build', schema: CLAIMS, model: a.buildModel, effort: 'high' })
if (!built) return { status: 'stopped: builder failed', rounds: [] }

let claims = built.claims
const rounds = []
const fixed = new Set()
let open = []
let stale = 0
let status = 'stopped: budget'

for (let round = 1; round <= maxRounds; round++) {
  const checked = await verify(claims, round)
  const failed = (checked?.results ?? []).filter((r) => !r.held)
  const review = await agent(
    `Review the branch ${a.branch} in ${a.worktree} against this goal. You did not build it.\nGoal: ${a.goal}\nDecisions:\n${a.decisions}\n` +
    `Earlier findings (reuse their ids): ${JSON.stringify(open)}\nClaims that failed re-checking: ${JSON.stringify(failed)}\n` +
    'List what should be fixed before landing, and what is only nice to have. Read and run; do not edit.',
    { phase: 'Review', label: `review r${round}`, schema: REVIEW, model: a.reviewModel },
  )
  const shouldFix = (review?.findings ?? []).filter((f) => f.severity === 'should-fix')
  const returned = shouldFix.filter((f) => fixed.has(f.id))
  const newlyFixed = open.filter((f) => !shouldFix.some((s) => s.id === f.id))
  newlyFixed.forEach((f) => fixed.add(f.id))
  stale = round > 1 && newlyFixed.length === 0 ? stale + 1 : 0
  open = shouldFix

  // improve-until-done stop rules, in order
  const allHeld = checked && failed.length === 0 && claims.every((c) => c.grade !== 'Inferred')
  const decision = !review ? 'stop: cannot verify (review did not return)'
    : shouldFix.length === 0 && allHeld ? 'stop: done'
    : shouldFix.length === 0 ? 'stop: cannot verify (re-run the failed claims alone, then ask the user)'
    : returned.length ? `stop: plateau (${returned.map((f) => f.id).join(', ')} came back)`
    : stale >= 2 ? 'stop: plateau (two rounds fixed nothing new)'
    : round === maxRounds ? 'stop: budget'
    : 'go again'
  rounds.push({ round, tried: round === 1 ? built.summary : rounds[rounds.length - 1].fix, failedClaims: failed, open: shouldFix, decision })
  log(`round ${round}: ${shouldFix.length} should-fix, ${failed.length} claims failed → ${decision}`)
  if (decision !== 'go again') { status = decision; break }

  const fix = await agent(`${rules}\nFix these findings on the branch and commit. Change the approach if a fix did not hold.\n${JSON.stringify(shouldFix)}\nReturn your claims.`,
    { phase: 'Fix', label: `fix r${round}`, schema: CLAIMS, model: a.buildModel })
  if (!fix) { status = 'stop: fixer failed'; break }
  claims = fix.claims
  rounds[rounds.length - 1].fix = fix.summary
}

phase('Final')
const final = status === 'stop: done'
  ? await agent(`In ${a.worktree}, run exactly this, alone, and nothing else: ${a.finalCheck}`, { label: 'final check', schema: FINAL, effort: 'low' })
  : null

// The coordinator still re-runs the final check before citing it, writes the explain page and asks the user.
return { status, rounds, final }
