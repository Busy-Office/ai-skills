export const meta = {
  name: 'standard-batch',
  description: 'Build one batch in an existing worktree, verify its claims, review it fresh, fix in bounded rounds, then run the final check alone',
  whenToUse: 'Steps 3-7 of the busy-office-mode feature playbook for one batch, after the user opted in to a workflow. Trial on one batch first; compare tokens with the manual way.',
  phases: [
    { title: 'Build', detail: 'one builder in the worktree' },
    { title: 'Verify', detail: 'a cheap agent re-runs every claim' },
    { title: 'Review', detail: 'a fresh reviewer' },
    { title: 'Fix', detail: 'a fresh fixer per round' },
    { title: 'Final', detail: 'the full check, alone' },
  ],
}

// args, filled by the coordinator from the brief (deploy-agents/SKILL.md):
// {
//   goal, worktree, branch,          // the worktree already exists; every agent works in it
//   dontTouch: [...],                // paths and actions out of bounds
//   decisions: '...',                // the user's decisions, verbatim
//   testCommands: [...],             // targeted checks the agents may run
//   finalCheck: '...',               // the full suite: run once, alone, at the end
//   buildModel, reviewModel,         // optional; every agent is a fresh context either way
//   maxRounds: 3,                    // review rounds (improve-until-done budget), never above 3
//   roundTokens: 100000,             // with a "+Nk" budget: stop when less than this remains
// }
// Sequential by design: one agent touches the worktree at a time, so no
// isolation option and no two test suites at once.
//
// Returns { status, why, rounds, final }. status, the improve-until-done stop
// rules plus three of this script's own:
//   done           clean review, every claim Ran or Read, final check green
//   plateau        a fixed finding came back, or two rounds fixed nothing new
//   budget         3 review rounds used, or the "+Nk" budget cannot pay a round
//                  (agent count and minutes stay with the coordinator)
//   scope growth   an agent named a new contract, package or permission
//   cannot verify  a check, the verifier, the reviewer or the final check did not run
//   unproven       clean review, but a claim is still Inferred or none was returned
//   final red      the full suite failed after a clean review
//   agent failed   the builder or a fixer did not return

const SCOPE = { type: 'array', items: { type: 'string' }, description: 'a new contract, package or permission the work needs; empty if none' }

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
    scopeGrowth: SCOPE,
  },
  required: ['summary', 'claims', 'scopeGrowth'],
}

const VERIFIED = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      description: 'one per claim, in the order given',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          couldRun: { type: 'boolean', description: 'false when the check itself could not run' },
          held: { type: 'boolean' },
          grade: { type: 'string', enum: ['Ran', 'Read', 'Inferred'], description: 'the grade the claim earns now' },
          evidence: { type: 'string' },
        },
        required: ['claim', 'couldRun', 'held', 'grade', 'evidence'],
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
          id: { type: 'string', description: 'reuse the id of an earlier finding, open or fixed, when it is the same problem' },
          severity: { type: 'string', enum: ['should-fix', 'nice-to-have'] },
          where: { type: 'string' },
          problem: { type: 'string' },
        },
        required: ['id', 'severity', 'where', 'problem'],
      },
    },
    scopeGrowth: SCOPE,
  },
  required: ['findings', 'scopeGrowth'],
}

const FINAL = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, tail: { type: 'string', description: 'last lines of the output' } },
  required: ['passed', 'tail'],
}

const a = args
const maxRounds = Math.min(a.maxRounds ?? 3, 3)
const roundTokens = a.roundTokens ?? 100000
const rules = [
  `Work only in ${a.worktree} on branch ${a.branch}. Never push, merge or land.`,
  `Do not touch: ${(a.dontTouch ?? []).join('; ') || 'nothing listed'}.`,
  `The user's decisions, verbatim:\n${a.decisions}`,
  `Targeted checks you may run: ${(a.testCommands ?? []).join(' | ') || 'none listed'}. Never run the full suite (${a.finalCheck}); it runs once, alone, at the end.`,
  'If the goal needs a new contract, package or permission, do not add it: name it in scopeGrowth.',
  'Grade every claim Ran (a tool printed it), Read (file:line) or Inferred.',
].join('\n')
const stop = (status, why, rounds, final = null) => ({ status, why, rounds, final })
if (a.buildModel && a.buildModel === a.reviewModel) log('builder and reviewer run on the same model; the reviewer is still a fresh context')

phase('Build')
let work = await agent(`Goal: ${a.goal}\n${rules}\nBuild it and commit on the branch. Return your claims.`,
  { label: 'build', schema: CLAIMS, model: a.buildModel, effort: 'high' })
if (!work) return stop('agent failed', 'the builder did not return', [])

const rounds = []
const fixed = []   // findings fixed in earlier rounds, as objects, so a returning one keeps its id
let open = []
let stale = 0
let result = null

for (let round = 1; round <= maxRounds && !result; round++) {
  if (work.scopeGrowth?.length) { result = ['scope growth', work.scopeGrowth.join('; ')]; break }
  if (budget.total && budget.remaining() < roundTokens) { result = ['budget', `${budget.remaining()} tokens left, a round needs about ${roundTokens}`]; break }

  // verifier on the edge: no claim reaches the reviewer or the coordinator unchecked
  const checked = await agent(
    `${rules}\nIn ${a.worktree}, re-run or re-read each claim's check, one result per claim in order. ` +
    'An Inferred claim: try to run or read what would show it, and grade it Ran or Read if it holds. ' +
    `Set couldRun false only when the check itself cannot run.\n${JSON.stringify(work.claims)}`,
    { phase: 'Verify', label: `verify r${round}`, schema: VERIFIED, effort: 'low' })
  const results = checked?.results ?? []
  if (!checked || results.length !== work.claims.length) { result = ['cannot verify', 'the verifier did not return a result per claim']; break }
  const blocked = results.filter((r) => !r.couldRun)
  if (blocked.length) { result = ['cannot verify', `could not run: ${blocked.map((r) => r.claim).join('; ')} — re-run alone, then ask the user`]; break }
  const failed = results.filter((r) => !r.held)
  const unproven = results.filter((r) => r.held && r.grade === 'Inferred')

  const review = await agent(
    `${rules}\nReview the branch ${a.branch} in ${a.worktree} against the goal. You did not build it. Read and run targeted checks; do not edit.\n` +
    `Goal: ${a.goal}\nEarlier findings (reuse their ids): ${JSON.stringify({ open, fixed })}\n` +
    'List what should be fixed before landing, and what is only nice to have.',
    { phase: 'Review', label: `review r${round}`, schema: REVIEW, model: a.reviewModel })
  if (!review) { result = ['cannot verify', 'the reviewer did not return']; break }
  if (review.scopeGrowth?.length) { result = ['scope growth', review.scopeGrowth.join('; ')]; break }

  // a claim that failed re-checking is a finding for the next round
  const shouldFix = [
    ...review.findings.filter((x) => x.severity === 'should-fix'),
    ...failed.map((r) => ({ id: `claim: ${r.claim}`, severity: 'should-fix', where: 'claim', problem: `did not hold: ${r.evidence}` })),
  ]
  const returned = shouldFix.filter((x) => fixed.some((y) => y.id === x.id))
  const newlyFixed = open.filter((x) => !shouldFix.some((y) => y.id === x.id))
  fixed.push(...newlyFixed)
  stale = round > 1 && newlyFixed.length === 0 ? stale + 1 : 0
  open = shouldFix

  // improve-until-done stop rules, in order
  const decision = shouldFix.length === 0 && work.claims.length === 0 ? ['unproven', 'no claims returned, so nothing was checked']
    : shouldFix.length === 0 && unproven.length === 0 ? ['done', 'no should-fix findings; every claim Ran or Read']
    : shouldFix.length === 0 ? ['unproven', `still Inferred: ${unproven.map((r) => r.claim).join('; ')}`]
    : returned.length ? ['plateau', `came back: ${returned.map((x) => x.id).join(', ')}`]
    : stale >= 2 ? ['plateau', 'two rounds fixed nothing new']
    : round === maxRounds ? ['budget', `${maxRounds} review rounds used, ${shouldFix.length} should-fix open`]
    : null
  rounds.push({ round, tried: work.summary, failedClaims: failed, open: shouldFix, decision: decision ? `stop: ${decision[0]}` : 'go again' })
  log(`round ${round}: ${shouldFix.length} should-fix, ${failed.length} claims failed → ${decision ? decision[0] : 'go again'}`)
  if (decision) { result = decision; break }

  work = await agent(`${rules}\nFix these findings on the branch and commit. Change the approach if a fix did not hold.\n${JSON.stringify(shouldFix)}\nReturn your claims.`,
    { phase: 'Fix', label: `fix r${round}`, schema: CLAIMS, model: a.buildModel })
  if (!work) { result = ['agent failed', `the fixer did not return in round ${round}`]; break }
}
if (!result) result = ['budget', `${maxRounds} review rounds used`]
if (result[0] !== 'done') return stop(result[0], result[1], rounds)

phase('Final')
const final = await agent(`In ${a.worktree}, run exactly this, alone, and nothing else: ${a.finalCheck}. Never push.`,
  { label: 'final check', schema: FINAL, effort: 'low' })
if (!final) return stop('cannot verify', 'the final check did not return — re-run it alone, then ask the user', rounds)
if (!final.passed) return stop('final red', 'the full suite failed after a clean review', rounds, final)

// The coordinator still re-runs the final check before citing it, writes the explain page and asks the user.
return stop('done', result[1], rounds, final)
