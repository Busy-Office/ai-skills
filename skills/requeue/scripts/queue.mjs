#!/usr/bin/env node
// requeue: pull every queue item a project keeps, with the attributes that
// decide order. Evidence only — no ranking, no rewriting.
//
// Usage: node queue.mjs [repoPath] [--max-age-probe 25] [--json-only]
//        node queue.mjs --self-test
//
// Read-only. Never writes to the target repo; runs only `git log`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);

const QUEUE_FILE = /(backlog|roadmap|todo|tasks?|milestones?|plan|next|queue|gates?|scenarios)/i;
const INTENT_FILE = /(intent|vision|purpose|charter|why|goals?|objectives?|prd|north-?star|readme)/i;
const VAGUE = /\b(improve|improved|look at|consider|explore|clean ?up|tidy|polish|review|refactor|better|nice to have|maybe|somehow|etc\.?)\b/i;
const ACCEPTANCE = /(acceptance|\bAC:|done when|so that|until|exit test|expected\b|verif|passes?\b|returns?\b|must\b|should\b|repro\b|≤|>=|<=|→|\d+\s*(ms|s|%|px|rows?|tokens?))/i;
const BLOCKED = /\b(blocked|blocker|waiting on|waiting for|needs decision|needs approval|depends on|pending|on hold|TBD)\b/i;
// Deliberately narrow: an item merely *tagged* [domain] or touching accounts is
// not human-only work, and a false positive here strands loop work in the gate list.
const HUMAN = /\b(needs?-?human|human input|by hand|manually|ask (the )?(user|owner)|sign-?off|countersign|credential|api key|dns record|billing (portal|console)|in the .{0,20}console)\b/i;
const ITEM = /^(\s*)(?:[-*+]\s+\[( |x|X|~|-)\]\s+|[-*+]\s+|\d+[.)]\s+)(.+)$/;
// Items are routinely several lines long, with the acceptance criterion in the
// continuation. Reading only the first line both loses that and mistakes a
// wrapped line beginning "+ something" for a new item.
const CLOSED = /\b(closed|superseded|cancelled|canceled|dropped|wont-?fix|won't fix|obsolete|no action needed)\b/i;

function walk(root, maxDepth = 5) {
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

function norm(s) {
  return s.toLowerCase().replace(/[`*_~\[\]()]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function parseFile(repoPath, rel) {
  let text; try { text = readFileSync(join(repoPath, rel), "utf8"); } catch { return null; }
  const lines = text.split("\n");
  const items = []; const headings = [];
  let section = null, inCode = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) { section = h[2].trim(); headings.push({ heading: section, level: h[1].length, line: i + 1 }); return; }
    const m = line.match(ITEM);
    if (!m) { if (items.length && /^\s+\S/.test(line) && !/^\s*$/.test(line)) items[items.length - 1]._cont.push(line.trim()); return; }
    const raw = m[3].trim();
    if (raw.length < 4) return;
    const box = m[2];
    // A bullet indented under an open item, with no checkbox, is a wrapped line
    // or a sub-point — not a queue item of its own.
    if (box === undefined && m[1].length > 0 && items.length) { items[items.length - 1]._cont.push(raw); return; }
    items.push({
      file: rel, line: i + 1, section, text: raw.replace(/\s+/g, " ").slice(0, 240),
      _box: box, _raw: raw, _cont: [], indent: m[1].length,
    });
  });
  // Resolve each item against its full text — first line plus continuations.
  for (const it of items) {
    const full = [it._raw, ...it._cont].join(" ").replace(/\s+/g, " ");
    const box = it._box;
    it.status = box === undefined
      ? (/\bdone\b|✅|~~/i.test(it._raw) || CLOSED.test(it._raw) ? "done" : "open")
      : box === " " ? (CLOSED.test(full) ? "done" : "open") : /[xX]/.test(box) ? "done" : "wip";
    it.hasAcceptance = ACCEPTANCE.test(full);
    it.vague = VAGUE.test(full) && !it.hasAcceptance;
    it.blocked = BLOCKED.test(full) ? (full.match(BLOCKED)?.[0] ?? true) : null;
    it.needsHuman = HUMAN.test(full);
    it.words = full.split(/\s+/).length;
    it.lines = 1 + it._cont.length;
    it.norm = norm(it._raw);
    delete it._raw; delete it._cont; delete it._box;
  }
  return { file: rel, lines: lines.length, headings, items };
}

function ageProbe(repoPath, items, max) {
  const out = new Map();
  for (const it of items.slice(0, max)) {
    const needle = it.text.replace(/["`$\\]/g, "").slice(0, 60).trim();
    if (needle.length < 12) continue;
    try {
      const d = execSync(`git log -S"${needle}" --date=short --format=%ad -1 -- "${it.file}"`,
        { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8e6 }).trim();
      if (d) out.set(`${it.file}:${it.line}`, d);
    } catch { /* not in history */ }
  }
  return out;
}

export function queue(repoPath, opts = {}) {
  const files = walk(repoPath);
  const queueFiles = files.filter((f) => QUEUE_FILE.test(f) && !/^\.claude\/skills\//.test(f));
  const intentFiles = files
    .filter((f) => INTENT_FILE.test(f) && !QUEUE_FILE.test(f))
    .filter((f) => !/^\.claude\//.test(f) && !/(^|\/)(node_modules|ds-bundle|dist|vendor)\//.test(f))
    .filter((f) => f.split("/").length <= 2)          // the project's, not a sub-package's
    .slice(0, 6);

  const parsed = queueFiles.map((f) => parseFile(repoPath, f)).filter(Boolean).filter((p) => p.items.length);
  const items = parsed.flatMap((p) => p.items);
  const open = items.filter((i) => i.status === "open" || i.status === "wip");

  // duplicates: same normalised text in more than one place
  const byNorm = new Map();
  for (const it of items) {
    if (it.norm.length < 12) continue;
    if (!byNorm.has(it.norm)) byNorm.set(it.norm, []);
    byNorm.get(it.norm).push(`${it.file}:${it.line}`);
  }
  const duplicates = [...byNorm.entries()].filter(([, w]) => w.length > 1).map(([t, where]) => ({ text: t.slice(0, 80), where }));
  // contradictions: same text open in one place, done in another
  const contradictions = [...byNorm.entries()]
    .map(([t, where]) => ({ t, rows: items.filter((i) => i.norm === t) }))
    .filter(({ rows }) => rows.some((r) => r.status === "done") && rows.some((r) => r.status !== "done"))
    .map(({ t, rows }) => ({ text: t.slice(0, 80), open: rows.filter((r) => r.status !== "done").map((r) => `${r.file}:${r.line}`), done: rows.filter((r) => r.status === "done").map((r) => `${r.file}:${r.line}`) }));

  let ages = new Map();
  if (opts.git !== false) {
    try { ages = ageProbe(repoPath, open, Number(opts.maxAgeProbe ?? 25)); } catch { /* no git */ }
  }
  for (const it of open) { const a = ages.get(`${it.file}:${it.line}`); if (a) it.firstSeen = a; }

  const warnings = [];
  if (!parsed.length) warnings.push("no queue file found (backlog / roadmap / todo / milestones) — there is no queue to reprioritise");
  if (!intentFiles.length) warnings.push("no intent document found — ranking against purpose will be unanchored; ask for one");

  return {
    repoPath, collectedAt: new Date().toISOString(),
    queueFiles: parsed.map((p) => ({
      file: p.file, lines: p.lines,
      open: p.items.filter((i) => i.status === "open").length,
      wip: p.items.filter((i) => i.status === "wip").length,
      done: p.items.filter((i) => i.status === "done").length,
      sections: p.headings.filter((h) => h.level <= 3).map((h) => h.heading).slice(0, 20),
    })),
    intentFiles,
    items: open,
    summary: {
      files: parsed.length,
      open: open.length,
      done: items.length - open.length,
      withAcceptance: open.filter((i) => i.hasAcceptance).length,
      acceptanceShare: open.length ? Number((open.filter((i) => i.hasAcceptance).length / open.length).toFixed(2)) : null,
      vague: open.filter((i) => i.vague).length,
      blocked: open.filter((i) => i.blocked).length,
      needsHuman: open.filter((i) => i.needsHuman).length,
      duplicates: duplicates.length,
      contradictions: contradictions.length,
    },
    duplicates, contradictions, warnings,
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
    const got = queue(dir, { git: false });
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
    const i = args.indexOf("--max-age-probe");
    const repo = args.find((a, n) => !a.startsWith("--") && (i < 0 || n !== i + 1)) ?? process.cwd();
    const out = queue(repo, { maxAgeProbe: i >= 0 ? args[i + 1] : undefined });
    if (!args.includes("--json-only") && out.warnings.length) process.stderr.write(out.warnings.map((w) => "! " + w).join("\n") + "\n");
    process.stdout.write(JSON.stringify(out, null, 2));
  }
}
