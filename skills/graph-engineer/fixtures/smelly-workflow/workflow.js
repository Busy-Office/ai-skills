export const meta = {
  name: 'route-audit',
  description: 'Audit every route file for missing auth checks',
  phases: [{ title: 'Scan' }, { title: 'Verify' }, { title: 'Report' }],
}

const FINDING = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    line: { type: 'integer' },
    desc: { type: 'string' },
  },
  required: ['file', 'line', 'desc'],
}

const FINDINGS = {
  type: 'object',
  properties: { findings: { type: 'array', items: FINDING } },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, why: { type: 'string' } },
  required: ['real', 'why'],
}

const started = Date.now()
const items = args.files.slice(0, 20)

phase('Scan')
const scanned = await parallel(
  items.map((f) => () => agent(`Scan ${f} for routes with no auth check.`, { schema: FINDINGS })),
)
const findings = scanned.flatMap((r) => r.findings)

const labelled = findings.map((f) => ({ ...f, key: `${f.file}:${f.line}` }))
const checked = await parallel(
  labelled.map((f) => () => agent(`Is ${f.key} really missing auth? ${f.desc}`, { schema: VERDICT })),
)

const merged = await agent(`Combine these results into one list: ${JSON.stringify(checked)}`)

const confirmed = []
while (true) {
  const round = await parallel(
    items.map((f) => () => agent(`Find more auth gaps in ${f}.`, { schema: FINDINGS })),
  )
  const found = round.filter(Boolean).flatMap((r) => r.findings)
  const fresh = found.filter((b) => !confirmed.some((c) => c.file === b.file && c.line === b.line))
  const judged = await pipeline(
    fresh,
    (b) => {
      phase('Verify')
      return agent(`Refute: ${b.desc}`, { schema: VERDICT })
    },
    (v, b) => (v && v.real ? b : null),
  )
  confirmed.push(...judged.filter(Boolean))
}

phase('Report')
const report = await agent(`Write the audit report from: ${JSON.stringify(confirmed)} (${merged})`)
return { report, started }
