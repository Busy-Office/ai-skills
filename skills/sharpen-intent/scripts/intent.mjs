#!/usr/bin/env node
// sharpen-intent: find every place a project states why it exists, and the
// attributes that decide whether that statement can steer anything.
// Evidence only — no rewriting, no judgement.
//
// Usage: node intent.mjs [repoPath] [--json-only]
//        node intent.mjs --self-test
//
// Read-only. Never writes to the target repo; runs only `git log`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);

const INTENT_FILE = /(intent|vision|purpose|charter|mission|north-?star|strategy|prd|context|objectives?|goals?|okrs?|why)/i;
const INTENT_HEADING = /^(intent|purpose|why|vision|mission|objective|objectives|goal|goals|north star|the bet|problem|who (it )?is for|success|outcomes?|non-?goals?|out of scope|not doing|focus|okrs?)\b/i;
const QUEUE_FILE = /(backlog|roadmap|todo|tasks?|milestones?|queue)/i;
const RULES_FILE = /(CLAUDE\.md|AGENTS\.md|LOOPS?\.md|SKILL\.md|DEFINITION-OF-DONE\.md|CONTRIBUTING\.md)$/i;

const MEASURE = /(\d+\s*(%|x|ms|s|min|hours?|days?|weeks?|months?|users?|customers?|teams?|rows?|requests?|\$|€|£)|\b(p50|p95|p99)\b|≤|≥|<=|>=|\bby (Q[1-4]|20\d\d|\w+ 20\d\d)\b|\bwithin \d+)/i;
const AUDIENCE = /\b(for|serves?|users?|customers?|teams?|developers?|engineers?|operators?|owners?|founders?|analysts?|students?|patients?|clients?|maintainers?)\b/i;
const OUTPUT_WORD = /\b(build|ship|create|implement|add|write|make|develop|launch|migrate|refactor|rewrite|integrate|support)\b/i;
const OUTCOME_WORD = /\b(so that|so they|enables?|lets?|reduces?|removes?|saves?|avoids?|prevents?|means|instead of|without having to|no longer)\b/i;
const HEDGE = /\b(world-?class|best-in-class|seamless|robust|scalable|innovative|cutting-?edge|leverage|synerg|holistic|delight|empower|revolution|next-?gen|state of the art|frictionless|10x)\b/i;
const NONGOAL = /\b(non-?goals?|out of scope|not doing|we (are|'re) not|explicitly not|will not|won't)\b/i;
const STOPWORDS = new Set("the a an and or of to for in on with without that this it is are be as at by from into our we you they their its can will not no than then when where which who what how any all more most other some such only own same so too very just also new use used using make makes made get gets got give gives one two".split(" "));

function walk(root, maxDepth = 4) {
  const out = [];
  const rec = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!IGNORE.has(e.name)) rec(join(dir, e.name), depth + 1); }
      else if (/\.mdx?$/i.test(e.name)) out.push(relative(root, join(dir, e.name)));
    }
  };
  rec(root, 0);
  return out;
}

function terms(text) {
  const out = new Map();
  for (const w of String(text).toLowerCase().replace(/[^a-z0-9 -]/g, " ").split(/\s+/)) {
    const t = w.replace(/^-+|-+$/g, "");
    if (t.length < 4 || STOPWORDS.has(t)) continue;
    out.set(t, (out.get(t) ?? 0) + 1);
  }
  return out;
}

// sentences that make a claim about purpose
function statements(text) {
  const out = [];
  const lines = text.split("\n");
  let inCode = false, heading = null, underIntent = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h) { heading = h[1].replace(/[*_`#]/g, "").trim(); underIntent = INTENT_HEADING.test(heading); return; }
    const body = line.replace(/^[\s>*+-]*(\[[ xX~-]\]\s*)?/, "").trim();
    if (body.length < 20) return;
    if (/^[|:]/.test(body) || /^!\[/.test(body)) return;
    for (const raw of body.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const s = raw.trim();
      if (s.length < 20) continue;
      out.push({
        line: i + 1, heading, underIntentHeading: underIntent,
        text: s.replace(/\s+/g, " ").slice(0, 300),
        measurable: MEASURE.test(s),
        namesAudience: AUDIENCE.test(s),
        outcome: OUTCOME_WORD.test(s),
        outputOnly: OUTPUT_WORD.test(s) && !OUTCOME_WORD.test(s),
        hedge: (s.match(HEDGE) ?? [null])[0],
        words: s.split(/\s+/).length,
      });
    }
  });
  return out;
}

function lastChanged(repoPath, file) {
  try {
    return execSync(`git log --date=short --format=%ad -1 -- "${file}"`, { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch { return null; }
}

function analyseFile(repoPath, rel, opts) {
  let text; try { text = readFileSync(join(repoPath, rel), "utf8"); } catch { return null; }
  const sts = statements(text);
  const intentish = sts.filter((s) => s.underIntentHeading);
  const scope = intentish.length ? intentish : sts;
  if (!scope.length) return null;
  return {
    file: rel,
    lines: text.split("\n").length,
    headings: [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 30),
    intentHeadings: [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => m[1].trim()).filter((h) => INTENT_HEADING.test(h)),
    statements: scope.slice(0, 40),
    hasNonGoals: NONGOAL.test(text),
    measurableStatements: scope.filter((s) => s.measurable).length,
    audienceStatements: scope.filter((s) => s.namesAudience).length,
    outcomeStatements: scope.filter((s) => s.outcome).length,
    outputOnlyStatements: scope.filter((s) => s.outputOnly).length,
    hedges: [...new Set(scope.map((s) => s.hedge).filter(Boolean))],
    lastChanged: opts.git === false ? null : lastChanged(repoPath, rel),
  };
}

export function intent(repoPathIn, opts = {}) {
  const repoPath = repoPathIn;
  const files = walk(repoPath);
  const candidates = files.filter((f) => INTENT_FILE.test(basename(f)) || /^README\.mdx?$/i.test(f))
    .filter((f) => !QUEUE_FILE.test(basename(f)) && !/^skills?\//.test(f) && !/CHANGELOG/i.test(f))
    // Generated and vendored files sometimes carry an intent-shaped name — a
    // Playwright `error-context.md` is not a statement of purpose.
    .filter((f) => !/(^|\/)(test-results|playwright-report|coverage|snapshots?|__(tests?|snapshots?)__|out|tmp|\.next|storybook-static)\//i.test(f))
    .filter((f) => f.split("/").length <= 3);

  const sources = candidates.map((f) => analyseFile(repoPath, f, opts)).filter(Boolean);

  // also: intent-shaped headings living inside rules files
  const ruleFiles = files.filter((f) => RULES_FILE.test(f));
  const inRules = [];
  for (const f of ruleFiles) {
    const a = analyseFile(repoPath, f, opts);
    if (a && a.intentHeadings.length) inRules.push({ file: f, headings: a.intentHeadings, statements: a.statements.filter((s) => s.underIntentHeading).length });
  }

  // who points at the intent file
  const referencedBy = {};
  for (const s of sources) {
    const base = basename(s.file);
    const hits = [];
    for (const f of files) {
      if (f === s.file) continue;
      let t; try { t = readFileSync(join(repoPath, f), "utf8"); } catch { continue; }
      if (t.includes(base)) hits.push({ file: f, isRulesFile: RULES_FILE.test(f) });
    }
    referencedBy[s.file] = hits.slice(0, 20);
  }

  // traceability: do open queue items share distinctive terms with the intent?
  const queueFiles = files.filter((f) => QUEUE_FILE.test(basename(f)));
  const primary = sources.slice().sort((a, b) =>
    (b.intentHeadings.length - a.intentHeadings.length) ||
    (b.outcomeStatements - a.outcomeStatements) ||
    (INTENT_FILE.test(basename(a.file)) ? 1 : 0) - (INTENT_FILE.test(basename(b.file)) ? 1 : 0))[0] ?? null;
  const intentTerms = primary ? terms(primary.statements.map((s) => s.text).join(" ")) : new Map();
  const items = [];
  for (const f of queueFiles) {
    let t; try { t = readFileSync(join(repoPath, f), "utf8"); } catch { continue; }
    t.split("\n").forEach((line, i) => {
      const m = line.match(/^\s*[-*+]\s+\[( |~|-)\]\s+(.+)$/);
      if (!m) return;
      const text = m[2].replace(/\s+/g, " ").slice(0, 200);
      const shared = [...terms(text).keys()].filter((w) => intentTerms.has(w));
      items.push({ file: f, line: i + 1, text, sharedTerms: shared.slice(0, 6), traced: shared.length > 0 });
    });
  }

  const warnings = [];
  if (!sources.length) warnings.push("no intent-shaped document found — the project states nowhere why it exists");
  if (sources.length > 2) warnings.push(`${sources.length} documents make purpose claims — canonicity is undecided`);
  if (primary && !(referencedBy[primary.file] ?? []).some((h) => h.isRulesFile)) warnings.push(`no rules file (CLAUDE.md / LOOPS.md / SKILL.md) points at ${primary.file} — an actor would never load it`);

  return {
    repoPath, collectedAt: new Date().toISOString(),
    primary: primary?.file ?? null,
    sources, inRules, referencedBy,
    traceability: {
      openItems: items.length,
      traced: items.filter((i) => i.traced).length,
      share: items.length ? Number((items.filter((i) => i.traced).length / items.length).toFixed(2)) : null,
      untraced: items.filter((i) => !i.traced).slice(0, 20),
    },
    summary: {
      sources: sources.length,
      intentInRulesFiles: inRules.length,
      measurableStatements: sources.reduce((a, s) => a + s.measurableStatements, 0),
      outcomeStatements: sources.reduce((a, s) => a + s.outcomeStatements, 0),
      outputOnlyStatements: sources.reduce((a, s) => a + s.outputOnlyStatements, 0),
      hedges: [...new Set(sources.flatMap((s) => s.hedges))],
      hasNonGoals: sources.some((s) => s.hasNonGoals),
    },
    warnings,
  };
}

// --------------------------------------------------------------- self-test
function selfTest() {
  const root = join(HERE, "..", "fixtures");
  let failed = 0, total = 0;
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[/^\d+$/.test(k) ? Number(k) : k]), o);
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const exp = JSON.parse(readFileSync(join(dir, "expect.json"), "utf8"));
    const got = intent(dir, { git: false });
    let bad = 0;
    for (const [p, want] of Object.entries(exp)) {
      total++;
      const g = get(got, p);
      const ok = typeof want === "object" && want !== null ? JSON.stringify(g) === JSON.stringify(want) : g === want;
      if (!ok) { bad++; failed++; console.log(`✗ ${name}: ${p}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(g)}`); }
    }
    console.log(`${bad ? "·" : "✓"} ${name}`);
  }
  console.log(`\n${total - failed}/${total} assertions passed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const repo = args.find((a) => !a.startsWith("--")) ?? process.cwd();
    const out = intent(repo);
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
