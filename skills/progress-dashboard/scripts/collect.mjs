#!/usr/bin/env node
// progress-dashboard collector.
//
// Reads a project's records — decisions, questions, gates, roadmap, backlog,
// changelog, sessions, manual actions, git, GitHub — and emits one JSON blob.
// Deterministic: no judgement here. Discovery is manifest-first
// (.claude/progress.json), shape-detection second. Never runs a command the
// manifest did not declare.
//
// With "audience": "stakeholder" in the manifest it adds one block, `stakeholder`, joined for the
// plain-language page (phases, the current phase's steps, exit checks, milestones, key decisions,
// the activity word, blockers, wording pending). Without it the output is unchanged.
//
// Usage:
//   node collect.mjs [repoPath] [--no-gh] [--fast] [--profile] [--json-only]
//   node collect.mjs --self-test          # run fixtures/*/expect.json
//
// The collector is read-only and out-of-process: it never touches the target
// project's files, build, or git state (the only exception is a `refresh`
// command the manifest explicitly declares, and --fast skips even that).
//
// See ../references/manifest.md for the manifest keys and vocabulary.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "__archived", "graphify-out", ".next", "coverage", "vendor", "worktrees"]);
// Node types that are decisions. Everything else in a design graph (tasks, risks, gaps, UX items…) is inventory, not a decision.
const DECISION_TYPES = new Set(["ADR", "DEC", "PRN", "PRIN", "DA", "POL", "STD", "CON"]);

// ---------------------------------------------------------------- vocabulary
const CANON = {
  decision: ["proposed", "accepted", "superseded", "rejected", "deferred"],
  question: ["open", "closed"],
  gate: ["open", "closed"],
  phase: ["closed", "current", "next", "planned"],
  backlog: ["todo", "doing", "done", "blocked"],
};
const MAP = {
  ratified: "accepted", approved: "accepted", confirmed: "accepted", amended: "accepted", built: "accepted", shipped: "accepted",
  parked: "deferred", postponed: "deferred", scheduled: "deferred",
  deprecated: "superseded", retired: "superseded", archived: "superseded",
  draft: "proposed", pending: "open", answered: "closed", resolved: "closed", signed: "closed", ruled: "closed", fixed: "accepted", "partially-resolved": "open",
  active: "current", done: "closed", verified: "closed", complete: "closed", completed: "closed", "in-progress": "doing", wip: "doing",
};

// ---------------------------------------------------------------- helpers
const fm = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
};
const firstWord = (s) => (s ?? "").replace(/\*\*/g, "").trim().split(/[\s,;:(—–]+/)[0].replace(/-$/, "").toLowerCase();
const stripMd = (s) => (s ?? "").replace(/\*\*|`|~~/g, "").trim();
const daysBetween = (a, b) => Math.round((b - a) / 864e5);
const toDate = (s) => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d : null; };
const globToRe = (g) => {
  // tokenise first so later substitutions can't rewrite earlier ones
  const src = g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\?/g, "")
    .replace(//g, "(?:.*/)?").replace(//g, ".*").replace(//g, "[^/]*").replace(//g, "[^/]");
  return new RegExp("^" + src + "$");
};

// ---------------------------------------------------------------- stakeholder helpers (pure; exported for the self-test)
const STEP_STATUS = ["done", "in progress", "not started"];
const EC_STATUS = { met: "done", current: "now", not_met: "next" };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// The engineer note for a roadmap with no phase markers; the stakeholder view withdraws it when it finds the current phase another way.
const noMarkersNote = (file) => `${file} carries no phase status markers — current phase cannot be determined from it.`;
// "Phase 3", "phase-3", "phase3": every phase number a line of text names.
const phaseNumbersIn = (s) => [...String(s ?? "").matchAll(/\bphase[\s-]*(\d+)(?!\d)/gi)].map((m) => Number(m[1]));

// "Moving" under quietDays, "Quiet" up to and including stalledDays, "Stalled" beyond. Days since the latest milestone, not commit.
export function activityWord(days, t) {
  if (days == null) return null;
  return days < t.quietDays ? "Moving" : days <= t.stalledDays ? "Quiet" : "Stalled";
}

// Format B, version 1. Returns a list of problems; empty means valid.
export function validateExitCriteria(x) {
  if (!isObj(x)) return ["the top level is not an object"];
  if (x.version !== 1) return [`version is ${JSON.stringify(x.version)}, expected 1`];
  const errs = [];
  const str = (v) => typeof v === "string", num = (v) => typeof v === "number" && Number.isFinite(v), bool = (v) => typeof v === "boolean";
  if (!num(x.overall)) errs.push("overall is not a number");
  if (!Array.isArray(x.phases) || !x.phases.length) return [...errs, "phases is not a non-empty list"];
  x.phases.forEach((p, i) => {
    const at = `phases[${i}]`;
    if (!isObj(p)) { errs.push(`${at} is not an object`); return; }
    if (!str(p.id) || !p.id) errs.push(`${at}.id is not text`);
    if (!Number.isInteger(p.number)) errs.push(`${at}.number is not a whole number`);
    if (!str(p.title)) errs.push(`${at}.title is not text`);
    if (!Object.hasOwn(EC_STATUS, String(p.status))) errs.push(`${at}.status is ${JSON.stringify(p.status)}, expected met, current or not_met`);
    if (!Array.isArray(p.rows)) errs.push(`${at}.rows is not a list`);
    else p.rows.forEach((r, j) => {
      const a = `${at}.rows[${j}]`;
      if (!isObj(r)) { errs.push(`${a} is not an object`); return; }
      if (!str(r.id) || !r.id) errs.push(`${a}.id is not text`);
      if (!str(r.title)) errs.push(`${a}.title is not text`);
      if (!num(r.level)) errs.push(`${a}.level is not a number`);
      if (!num(r.target)) errs.push(`${a}.target is not a number`);
      if (!bool(r.atTarget)) errs.push(`${a}.atTarget is not true or false`);
      if (!str(r.note)) errs.push(`${a}.note is not text`);
    });
    if (!Array.isArray(p.manual)) errs.push(`${at}.manual is not a list`);
    else p.manual.forEach((m, j) => {
      const a = `${at}.manual[${j}]`;
      if (!isObj(m) || !str(m.title) || !bool(m.done)) errs.push(`${a} needs a text title and a true/false done`);
    });
  });
  if (x.phases.filter((p) => p?.status === "current").length > 1) errs.push("more than one phase is current");
  return errs;
}

// CHANGELOG entries with a date: "## 2026-09-27 — heading", "## [1.2.0] — 2026-08-27 (summary)", "## 1.2.0 (2026-08-01)". Newest first.
export function parseMilestones(text) {
  const out = [];
  for (const m of (text ?? "").matchAll(/^##\s+(.+?)\s*$/gm)) {
    const h = m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, "[$1]"); // "[1.2.0](compare-url)" → "[1.2.0]"
    const s = h.match(/^(?:\[?v?(\d+\.\d+\.\d+[\w.-]*)\]?\s*(?:—|–|-|:)?\s*)?\(?(\d{4}-\d{2}-\d{2})\)?\s*(?:—|–|-|:)?\s*(.*)$/);
    const date = s?.[2] ?? h.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
    if (!date) continue; // "Unreleased" and undated headings are not milestones
    let heading = s ? s[3].trim() : h.trim();
    const paren = heading.match(/^\((.*)\)$/); if (paren) heading = paren[1].trim();
    out.push({ date, heading: stripMd(heading) || null, version: s?.[1] ?? null });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)); // stable: same-day entries keep file order
}

// The section of a roadmap under "## Phase <n> …" (or ###), up to the next heading of the same or higher level.
export function phaseSection(text, number) {
  const lines = (text ?? "").split("\n");
  const re = new RegExp(`^(#{2,3})\\s+(?:[^\\w\\s#\`]+\\s*)?(?:Phase|Stage|Milestone)[\\s-]*${number}(?![\\w.])`, "i");
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const end = new RegExp(`^#{1,${lines[i].match(/^#+/)[0].length}}\\s`);
  let j = i + 1;
  while (j < lines.length && !end.test(lines[j])) j++;
  return lines.slice(i + 1, j).join("\n");
}

// The numbered work-items table in a phase section: first cell a step number, a "Status" column of done / in progress / not started.
export function parseStepTable(section) {
  const tables = []; let cur = null;
  for (const line of (section ?? "").split("\n")) {
    if (!/^\s*\|/.test(line)) { cur = null; continue; }
    if (/^\s*\|[\s:|-]+$/.test(line)) continue; // separator row
    const cells = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
    if (!cur) { cur = { header: cells.map((c) => stripMd(c).toLowerCase()), rows: [] }; tables.push(cur); continue; }
    cur.rows.push(cells);
  }
  const numbered = tables.filter((t) => t.rows.some((r) => /^\d+$/.test(stripMd(r[0]))));
  if (!numbered.length) return { steps: [], problem: "no numbered work-items table" };
  const t = numbered.find((x) => x.header.includes("status")) ?? numbered[0];
  const si = t.header.indexOf("status");
  if (si < 0) return { steps: [], problem: "the work-items table has no Status column" };
  const ni = t.header.findIndex((h) => /^(item|step|work item|name|title|what)$/.test(h));
  const steps = t.rows.filter((r) => /^\d+$/.test(stripMd(r[0]))).map((r) => {
    const raw = stripMd(r[si] ?? "");
    const norm = raw.toLowerCase().replace(/\s+/g, " ");
    return { number: stripMd(r[0]), name: stripMd(r[ni > 0 ? ni : 1] ?? "").slice(0, 200), status: STEP_STATUS.includes(norm) ? norm : null, statusRaw: raw };
  });
  return { steps, problem: null };
}

function walk(root, maxDepth = 6) {
  const out = [];
  const rec = (dir, depth) => {
    if (depth > maxDepth) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) rec(join(dir, e.name), depth + 1); }
      else out.push(relative(root, join(dir, e.name)));
    }
  };
  rec(root, 0);
  return out;
}

// ---------------------------------------------------------------- collector
export function collect(repoPath, opts = {}) {
  // fast: local files only — no GitHub, no per-file git history, no refresh command. ~0.2s on a 7k-file repo.
  const { noGh = false, git = true, fast = false } = opts;
  const skipGh = noGh || fast;
  const t0 = Date.now(); const timings = {}; let tPrev = t0;
  const mark = (label) => { const n = Date.now(); timings[label] = n - tPrev; tPrev = n; };
  const read = (p) => { const f = join(repoPath, p); return existsSync(f) ? readFileSync(f, "utf8") : null; };
  const allFiles = walk(repoPath);
  // Candidate order is priority order (ROADMAP.md before ROADMAP-archive.md), so match pattern by pattern.
  const glob = (patterns) => {
    const seen = new Set(), out = [];
    for (const re of patterns.map(globToRe)) for (const f of [...allFiles].sort()) if (re.test(f) && !seen.has(f)) { seen.add(f); out.push(f); }
    return out;
  };
  const sh = (cmd, cwd = repoPath) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  // git with an argument list, no shell: a file name such as "ADR-1-$(cmd).md" stays a file name.
  const gitOut = (args) => execFileSync("git", args, { cwd: repoPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

  const manifest = (() => { try { return JSON.parse(read(".claude/progress.json") ?? "null") ?? {}; } catch (e) { return { __error: String(e) }; } })();
  const vocab = { ...MAP, ...Object.fromEntries(Object.entries(manifest.vocabulary ?? {}).map(([k, v]) => [k.toLowerCase(), v])) };
  const canon = (raw, kind) => {
    const w = firstWord(raw);
    if (!w) return null;
    if (CANON[kind].includes(w)) return w;
    const m = vocab[w];
    if (m && CANON[kind].includes(m)) return m;
    // cross-kind conveniences
    if (kind === "question" || kind === "gate") { if (/^(accepted|closed|done|ruled)/.test(w)) return "closed"; if (/^(proposed|open|pending)/.test(w)) return "open"; }
    if (kind === "phase") { if (/^(closed|done|shipped|complete|superseded|dropped|cancelled)/.test(w)) return "closed"; if (/^(active|current|doing|in)/.test(w)) return "current"; if (/^(open|next|planned|todo)/.test(w)) return "planned"; }
    return null;
  };

  const now = opts.now ? new Date(opts.now) : new Date(); // opts.now pins the clock for fixtures
  const out = {
    project: manifest.project ?? basename(repoPath),
    repoPath,
    collectedAt: now.toISOString(),
    collectedAtLocal: now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    manifest: manifest.__error ? null : manifest,
    git: null,
    staleness: null,
    decisions: [],
    decisionCounts: {},
    otherNodes: { count: 0, byType: {}, needsHuman: [] },
    openQuestions: [],
    gates: [],
    phases: [],
    roadmap: null,
    backlog: null,
    releases: [],
    sessions: [],
    manualActions: [],
    github: { repos: [] },
    capabilities: null,
    momentum: { events: [], cadence: null },
    humanItems: [],
    sources: [],
    notes: { dataQuality: [], config: [] },
    warnings: [],
  };
  if (manifest.__error) out.warnings.push(`.claude/progress.json is not valid JSON: ${manifest.__error}`);

  const lastChanged = (p) => {
    if (git && !fast) { try { const iso = gitOut(["log", "-1", "--format=%cI", "--", p]); if (iso) return iso; } catch { /* fall through */ } }
    try { return statSync(join(repoPath, p)).mtime.toISOString(); } catch { return null; }
  };
  const source = (axis, path, how, shape, extra = {}) => {
    if (!out.sources.some((s) => s.path === path && s.axis === axis)) out.sources.push({ axis, path, how, shape, lastChanged: lastChanged(path), ...extra });
  };
  const pick = (key, defaults) => {
    const m = manifest[key];
    if (m) return { files: glob(Array.isArray(m) ? m : [m]), how: "manifest" };
    return { files: glob(defaults), how: "shape" };
  };
  const unmapped = new Set();
  // Cap per kind: a messy graph can have dozens of one-off statuses, and the page needs a sentence, not a list.
  const vocabNoteCount = {};
  const noteVocab = (raw, kind, where) => {
    const k = `${firstWord(raw)}→${kind}`; if (unmapped.has(k)) return; unmapped.add(k);
    const n = (vocabNoteCount[kind] = (vocabNoteCount[kind] ?? 0) + 1);
    if (n <= 5) out.notes.dataQuality.push(`Status "${stripMd(raw).slice(0, 40)}" in ${where} has no ${kind} mapping — shown raw.`);
    else if (n === 6) out.notes.dataQuality.push(`…and more unmapped ${kind} statuses in ${where} (see decisionCounts.unmapped). Add them under "vocabulary" in .claude/progress.json.`);
  };

  // ------------------------------------------------------------ git
  if (git) {
    try {
      const [sha, iso, subject, author] = sh("git log -1 --format=%h%x00%cI%x00%s%x00%an").split("\0");
      let branch = null; try { branch = sh("git rev-parse --abbrev-ref HEAD"); } catch { /* detached */ }
      const since = (d) => Number(sh(`git rev-list --count --since="${d} days ago" HEAD`));
      const last14 = since(14), last28 = since(28);
      mark("git");
      out.git = {
        sha, branch, at: iso, atLocal: new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
        subject, author, ageHours: Math.round((now - new Date(iso)) / 36e5), ageDays: daysBetween(new Date(iso), now),
        commitsLast14: last14, commitsPrior14: last28 - last14,
      };
    } catch {
      out.warnings.push("Not a git repository (or no commits) — below the skill's floor.");
    }
  }

  // ------------------------------------------------------------ decisions
  const decisionDefaults = [
    "docs/decisions/*.md", "docs/decisions/**/*.yaml", "docs/decisions/**/*.yml", "docs/adr/*.md", "docs/adrs/*.md", "adr/*.md", "ADRs/*.md", "decisions/*.md",
    "**/wiki/decisions/*.md", "records/decisions/*.md", "spec/decisions/*.md",
    "DESIGN-GRAPH.md", "docs/DESIGN-GRAPH.md", "docs/graph/*.md", "graph/*.md", "docs/GAP-REGISTER.md",
  ];
  const dec = pick("decisions", decisionDefaults);
  const registerRows = new Map(); // "0012" -> status from an index table
  const pushDecision = (d) => {
    if (!d.id || out.decisions.some((x) => x.id === d.id)) return;
    d.type = d.type ?? d.id.split("-")[0].toUpperCase();
    if (d.type === "OQ" || d.type === "Q") return; // questions handled separately
    if (!DECISION_TYPES.has(d.type) && !/^(ADR|DEC)/.test(d.id)) {
      // graph inventory (tasks, risks, gaps, UX items). Counted, not judged — except when it names a human.
      out.otherNodes.count++;
      const t = (out.otherNodes.byType[d.type] ??= { total: 0, byStatus: {} });
      t.total++; const s = firstWord(d.status) || "none"; t.byStatus[s] = (t.byStatus[s] ?? 0) + 1;
      if (/needs-?human|owner-?call|human-?gate/i.test(d.status ?? "")) out.otherNodes.needsHuman.push({ id: d.id, type: d.type, title: d.title, status: stripMd(d.status), source: d.source });
      return;
    }
    d.canonical = d.type === "DA" ? "deliberate-absence" : canon(d.status, "decision");
    if (d.status && !d.canonical && d.type !== "DA") noteVocab(d.status, "decision", d.source);
    out.decisions.push(d);
  };
  const pushQuestion = (q) => {
    if (!q.id || out.openQuestions.some((x) => x.id === q.id)) return;
    q.canonical = q.struck ? "closed" : canon(q.status, "question") ?? "open";
    out.openQuestions.push(q);
  };

  // Shape 1 — markdown table rows whose first cell is TYPE-ID (design graph tables, gate tables, registers)
  const scanTableRows = (text, file) => {
    const rows = [];
    let section = null, header = null;
    for (const line of text.split("\n")) {
      const h = line.match(/^##+\s+(.+?)\s*$/);
      if (h) { section = h[1].replace(/\s*\(.*?\)\s*/g, "").trim(); header = null; continue; }
      if (/^\|\s*-+/.test(line)) continue;
      if (/^\|/.test(line) && !header) { header = line.split("|").map((c) => c.trim().toLowerCase()).filter(Boolean); continue; }
      // IDs: TYPE-suffix (ADR-0012, GATE-01-MYCASES), TYPE+digits (P0, MS-01, M3), or a bare register number (0012)
      const m = line.match(/^\|\s*(~~)?\s*\**([A-Z][A-Z0-9]*-[A-Za-z0-9-]+|[A-Z]{1,8}-?\d+[A-Za-z0-9.]*|\d{3,4})\**\s*(~~)?\s*\|(.*)$/);
      if (!m) continue;
      const cells = m[4].split("|").map((c) => c.trim()); if (cells.at(-1) === "") cells.pop();
      const col = (name) => { const i = header?.findIndex((c) => c.includes(name)); return i > 0 ? cells[i - 1] : undefined; };
      rows.push({ id: m[2], struck: Boolean(m[1]), cells, section, col, file });
    }
    return rows;
  };
  const statusFromCells = (cells) => cells.slice(1).find((c) => /^\*{0,2}(accepted|proposed|rejected|closed|open|answered|built|deferred|superseded|ruled|active|done|parked|amended|pending)\*{0,2}(\s|$)/i.test(c));

  // Shape 2 — line-per-node graph: "ID TYPE | title | status | rationale"
  const scanLineNodes = (text) => {
    const nodes = [];
    for (const line of text.split("\n")) {
      const m = line.match(/^(~~)?([A-Z][A-Z0-9]*-\d+[A-Za-z0-9.-]*)\s+([A-Z][A-Z0-9]*)\s*\|\s*(.*)$/);
      if (!m) continue;
      const cells = m[4].split("|").map((c) => c.trim());
      nodes.push({ id: m[2], type: m[3], title: stripMd(cells[0]), status: cells[1] ?? null, rest: cells.slice(2), struck: Boolean(m[1]) });
    }
    return nodes;
  };

  // Shape 3 — prose entries "### TYPE-ID — Title [— **status**]" with "- Type: X — **status**"
  const scanProseEntries = (text) => {
    const nodes = []; let cur = null;
    const flush = () => { if (cur) nodes.push(cur); cur = null; };
    for (const line of text.split("\n")) {
      const h = line.match(/^###\s+([A-Z][A-Z0-9]*-\d+)\s*(?:—|-)\s*(.+)$/);
      if (h) { flush(); const st = h[2].match(/(?:—|-)\s*\*\*(.+?)\*\*\s*$/); cur = { id: h[1], title: st ? h[2].slice(0, st.index).replace(/\s*(?:—|-)\s*$/, "").trim() : h[2].trim(), status: st ? st[1] : null, type: null }; continue; }
      if (cur && !cur.type) { const t = line.match(/^-\s*Type:\s*([A-Z][A-Z0-9]*)/); if (t) { cur.type = t[1]; if (!cur.status) cur.status = line.match(/\*\*(.+?)\*\*/)?.[1] ?? null; } }
    }
    flush();
    return nodes;
  };

  // Shape 4 — one decision per file: frontmatter status, or "## Status" section, or "- Status:" in a decision record
  const parseDecisionFile = (file, text) => {
    const meta = fm(text);
    const title = text.match(/^#\s+(.+)$/m)?.[1] ?? basename(file, ".md");
    const idm = title.match(/^([A-Z]{2,8})[- ]?(\d{2,5})\b/) ?? basename(file).match(/^([A-Z]{2,8})[- ]?(\d{2,5})\b/);
    if (!idm && meta.type !== "decision") return null;
    const id = idm ? `${idm[1]}-${idm[2]}` : basename(file, ".md");
    const status = meta.status ?? text.match(/^##\s+Status\s*\n+\s*([^\n]+)/m)?.[1] ?? text.match(/^-\s*Status:\s*([^\n]+)/m)?.[1] ?? null;
    const since = meta.date ?? meta.created ?? text.match(/^-\s*Session:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null;
    const owner = meta.owner ?? text.match(/^-\s*Decider:\s*([^\n]+)/m)?.[1] ?? null;
    const supersedes = text.match(/supersedes\s+(?:part of\s+)?([A-Z]{2,8}-\d+)/i)?.[1] ?? null;
    return { id, title: stripMd(title.replace(/^[A-Z]{2,8}[- ]?\d{2,5}\s*[—:-]\s*/, "")), status, since, owner, supersedes, source: file };
  };

  // Shape 5 — decision-session yaml (decision-session convention): items with status pending are open questions
  const parseDecisionsYaml = (file, text) => {
    const facilitator = text.match(/^\s+facilitator:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const date = text.match(/^\s+date:\s*"?([\d-]+)"?/m)?.[1] ?? null;
    const items = []; let cur = null;
    for (const line of text.split("\n")) {
      const start = line.match(/^\s*-\s+id:\s*(.+)$/);
      if (start) { if (cur) items.push(cur); cur = { id: start[1].trim() }; continue; }
      if (!cur) continue;
      const kv = line.match(/^\s{4,}([a-z_]+):\s*(.*)$/);
      if (kv && !/^\s{6,}/.test(line)) cur[kv[1]] = kv[2].replace(/^>-?\s*$/, "").trim() || cur[kv[1]] || "";
      else if (cur.notes !== undefined && /^\s{6,}\S/.test(line) && !cur.notesDone) cur.notes = (cur.notes + " " + line.trim()).trim();
    }
    if (cur) items.push(cur);
    for (const it of items) {
      const st = (it.status ?? "").toLowerCase();
      if (st === "pending" || st === "") {
        pushQuestion({ id: it.id, question: (it.notes || it.finding || it.id).slice(0, 160), owner: it.decider && it.decider !== "null" ? it.decider : facilitator, blocks: it.adr && it.adr !== "null" ? `ADR-${it.adr}` : null, status: "open", raised: date, source: file });
      }
    }
    return items.length;
  };

  for (const file of dec.files) {
    const text = read(file); if (!text) continue;
    if (/\/(README|INDEX)\.md$/i.test(file)) {
      for (const r of scanTableRows(text, file)) if (/^\d+$/.test(r.id)) registerRows.set(r.id.padStart(4, "0"), r.cells[1] ?? r.col?.("status"));
      source("decisions", file, dec.how, "register table");
      continue;
    }
    if (/TEMPLATE\.md$/i.test(file) || /DECISION_PACK|CHECKLIST/i.test(file)) continue;
    if (file.endsWith(".yaml") || file.endsWith(".yml")) { if (parseDecisionsYaml(file, text)) source("decisions", file, dec.how, "decision-session yaml"); continue; }

    const lineNodes = scanLineNodes(text);
    if (lineNodes.length) {
      source("decisions", file, dec.how, "line-per-node graph");
      for (const n of lineNodes) {
        // OQ rows are either "title | owner | blocks" or "title | status | owner | blocks". Decide by whether cell 2 reads as a status.
        if (n.type === "OQ") {
          const hasStatus = (n.status ?? "").length <= 30 && /(open|closed|answered|resolved|parked|deferred|pending|blocked)/i.test(n.status ?? "");
          let owner = (hasStatus ? n.rest[0] : n.status) ?? null;
          if (owner && owner.length > 40) owner = null; // that cell was prose, not a name
          pushQuestion({ id: n.id, question: n.title, owner, blocks: (hasStatus ? n.rest[1] : n.rest[0]) ?? null, status: n.struck ? "closed" : hasStatus ? n.status : "open", struck: n.struck, source: file });
        }
        else pushDecision({ id: n.id, type: n.type, title: n.title, status: n.struck ? "superseded" : n.status, note: n.rest[0] ?? null, replacement: n.type === "DA" ? n.rest[0] ?? null : undefined, reopen: n.type === "DA" ? n.rest[1] ?? null : undefined, source: file });
      }
      continue;
    }
    const rows = scanTableRows(text, file).filter((r) => !/^\d+$/.test(r.id));
    if (rows.length) {
      source("decisions", file, dec.how, "typed table rows");
      for (const r of rows) {
        const type = r.id.split("-")[0];
        const status = r.col?.("status") ?? statusFromCells(r.cells) ?? null;
        if (type === "OQ") pushQuestion({ id: r.id, question: stripMd(r.cells[0]), owner: r.col?.("owner") ?? r.cells[1] ?? null, blocks: r.col?.("block") ?? r.cells[2] ?? null, status, struck: r.struck, source: file });
        else if (type === "GATE") out.gates.push({ id: r.id, title: stripMd(r.cells[0]), status: r.struck ? "closed" : canon(status, "gate") ?? "open", owner: r.col?.("owner") ?? null, raised: r.col?.("raised") ?? r.col?.("date") ?? null, source: file });
        else pushDecision({ id: r.id, type, title: stripMd(r.cells[0]), status: r.struck ? "superseded" : status, section: r.section, replacement: type === "DA" ? r.col?.("replace") ?? r.cells[1] : undefined, reopen: type === "DA" ? r.col?.("reopen") ?? r.cells[2] : undefined, source: file });
      }
      continue;
    }
    const prose = scanProseEntries(text);
    if (prose.length) {
      source("decisions", file, dec.how, "prose entries");
      for (const n of prose) pushDecision({ id: n.id, type: n.type ?? undefined, title: n.title, status: n.status, source: file });
      continue;
    }
    const one = parseDecisionFile(file, text);
    if (one) { source("decisions", dirname(file), dec.how, fm(text).status ? "frontmatter decision notes" : "prose ADR with ## Status"); pushDecision(one); }
  }
  // register fills gaps + flags disagreement
  for (const d of out.decisions) {
    const num = d.id.match(/-(\d+)$/)?.[1]?.padStart(4, "0");
    const reg = num && registerRows.get(num);
    if (!reg) continue;
    if (!d.status) { d.status = reg; d.canonical = canon(reg, "decision"); }
    else if (canon(reg, "decision") && canon(reg, "decision") !== d.canonical) out.notes.dataQuality.push(`${d.id}: file says "${stripMd(d.status)}", register says "${stripMd(reg)}".`);
  }
  const noStatus = out.decisions.filter((d) => !d.status && d.type !== "DA");
  if (noStatus.length) out.notes.dataQuality.push(`${noStatus.length} decision${noStatus.length > 1 ? "s have" : " has"} no status: ${noStatus.slice(0, 5).map((d) => d.id).join(", ")}${noStatus.length > 5 ? ", …" : ""}.`);
  for (const d of out.decisions) { const k = d.canonical ?? "unmapped"; out.decisionCounts[k] = (out.decisionCounts[k] ?? 0) + 1; }
  if (dec.how === "shape" && dec.files.length) out.notes.config.push(`decisions found by shape in ${[...new Set(dec.files.map(dirname))].join(", ")} — pin with "decisions" in .claude/progress.json.`);

  // ------------------------------------------------------------ gates (heading form)
  const gate = pick("gates", ["docs/HUMAN-GATES-LOG.md", "HUMAN-GATES-LOG.md", "GATES.md", "docs/GATES.md"]);
  for (const file of gate.files) {
    const text = read(file); if (!text) continue;
    const rows = scanTableRows(text, file).filter((r) => /^GATE/i.test(r.id));
    if (rows.length) {
      source("gates", file, gate.how, "gate table");
      for (const r of rows) if (!out.gates.some((g) => g.id === r.id)) out.gates.push({ id: r.id, title: stripMd(r.cells[0]).slice(0, 160), status: r.struck ? "closed" : canon(r.col?.("status") ?? statusFromCells(r.cells) ?? r.cells.at(-1), "gate") ?? "open", owner: r.col?.("owner") ?? null, raised: r.col?.("raised") ?? null, source: file });
      continue;
    }
    const blocks = text.split(/^(?=##\s+GATE)/m).filter((b) => /^##\s+GATE/.test(b));
    if (blocks.length) {
      source("gates", file, gate.how, "gate headings with Status/Owner lines");
      for (const b of blocks) {
        const h = b.match(/^##\s+(GATE-[A-Z0-9-]+)\s*(?:—|-)?\s*(.*)$/m);
        const st = b.match(/^Status:\s*([A-Za-z]+)/m)?.[1] ?? null;
        const owner = b.match(/Owner:\s*([^\n|]+)/)?.[1]?.trim() ?? null;
        const raised = b.match(/Date logged:\s*([\d-]+)/)?.[1] ?? null;
        const total = (b.match(/^\s*- \[[ x]\]/gm) ?? []).length, done = (b.match(/^\s*- \[x\]/gim) ?? []).length;
        out.gates.push({ id: h[1], title: stripMd(h[2]), status: canon(st, "gate") ?? (total && done === total ? "closed" : "open"), owner, raised, checklist: total ? { done, total } : null, source: file });
      }
    }
  }
  if (gate.how === "shape" && gate.files.length) out.notes.config.push(`gates found by shape in ${gate.files.join(", ")} — pin with "gates".`);

  // ------------------------------------------------------------ roadmap
  const rm = pick("roadmap", ["ROADMAP.md", "docs/ROADMAP.md", "PROJECT-PLAN.md", "docs/PROJECT-PLAN.md", "PLAN.md", "docs/PLAN.md", "ROADMAP-*.md", "docs/ROADMAP-*.md"]);
  const roadmapFile = rm.files[0];
  if (roadmapFile) {
    const text = read(roadmapFile);
    const generated = /<!--\s*GENERATED/i.test(text) || /^_?Generated\s+\d{4}-/m.test(text);
    const generatedAt = text.match(/Generated\s+(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+|\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    out.roadmap = { file: roadmapFile, generated, generatedAt, shape: null, refresh: manifest.refresh ?? null };
    if (manifest.refresh && !opts.selfTest && !fast) {
      try { sh(manifest.refresh); out.roadmap.refreshed = true; } catch { out.warnings.push(`refresh command failed: ${manifest.refresh}`); }
    }
    const lines = text.split("\n");
    const phaseStatusFromAnnot = (s) => {
      if (!s) return null;
      if (/✅|\b(closed|done|shipped|complete)\b/i.test(s)) return "closed";
      if (/🟢|🔵|\b(active|current|in progress|doing)\b/i.test(s)) return "current";
      if (/\b(next)\b/i.test(s)) return "next";
      if (/\b(planned|later|future)\b/i.test(s)) return "planned";
      return null;
    };

    // A — "## Phase N — Title (dur)" / "## Stage N — Title `annot`" / "## 🟢 PHASE-0 — Title"
    let cur = null;
    const flushPhase = () => { if (cur) out.phases.push(cur); cur = null; };
    for (const line of lines) {
      const h = line.match(/^##\s+(?:([^\w\s#`]+)\s*)?((?:Phase|Stage|PHASE|Milestone|M)[\s-]*\d+[A-Za-z]?)\s*(?:—|–|-|:)\s*([^`(]+?)\s*(?:\(([^)]*)\))?\s*(?:`([^`]*)`)?\s*$/);
      if (h) {
        flushPhase();
        const annot = [h[1], h[4], h[5]].filter(Boolean).join(" ");
        cur = { id: h[2].replace(/\s+/g, "-").toUpperCase().replace(/^M-/, "M"), title: h[3].trim(), statusRaw: annot || null, status: phaseStatusFromAnnot(annot), exit: null, criteria: null, items: { total: 0, done: 0 } };
        continue;
      }
      if (!cur) continue;
      if (/^##\s/.test(line)) { flushPhase(); continue; }
      const exit = line.match(/^\s*-?\s*\*{0,2}(?:Exit|Exit criteria|Goal)\*{0,2}:?\*{0,2}\s*(.+)$/i);
      if (exit && !cur.exit) cur.exit = exit[1].trim();
      const req = line.match(/^###\s+(?:([^\w\s#`]+)\s*)?([A-Z]+-[\w-]+)\s*(?:—|-)\s*.*?`([a-z-]+)`\s*$/);
      if (req) { cur.items.total++; if (/verified|done|closed|shipped/.test(req[3]) || req[1] === "✅") cur.items.done++; }
      const box = line.match(/^\s*- \[([ x])\]/i);
      if (box) { cur.items.total++; if (box[1].toLowerCase() === "x") cur.items.done++; }
    }
    flushPhase();
    if (out.phases.length) out.roadmap.shape = generated ? "generated phase headings with requirement items" : "phase headings with exit criteria";

    // B — tables: "| P0 | scope | exit |" or "| MS-01 | Milestone | Status | Notes |"
    if (!out.phases.length) {
      for (const r of scanTableRows(text, roadmapFile)) {
        if (!/^(P-?\d+|MS-\d+|M\d+|PH-\d+)$/i.test(r.id)) continue;
        const st = r.col?.("status") ?? statusFromCells(r.cells) ?? null;
        out.phases.push({ id: r.id.toUpperCase(), title: stripMd(r.cells[0]).slice(0, 120), statusRaw: st, status: canon(st, "phase"), exit: r.col?.("exit") ?? (st ? null : r.cells[1] ?? null), criteria: null, items: { total: 0, done: 0 }, section: r.section });
        if (st && !canon(st, "phase")) noteVocab(st, "phase", roadmapFile);
      }
      if (out.phases.length) out.roadmap.shape = "milestone table";
    }
    if (!out.phases.length) {
      out.roadmap.shape = /^##\s+Objective/m.test(text) ? "prose objectives (no phases)" : "unrecognised";
      out.notes.dataQuality.push(`${roadmapFile} defines no phases or milestones the collector recognises — phase progress not shown.`);
    }
    // items → criteria; derive current phase
    for (const p of out.phases) {
      if (p.items.total) { p.criteria = { met: p.items.done, total: p.items.total }; if (!p.status) p.status = p.items.done === p.items.total ? "closed" : "current"; }
      delete p.items;
    }
    const hasAnyStatus = out.phases.some((p) => p.status);
    if (out.phases.length && !hasAnyStatus) out.notes.dataQuality.push(noMarkersNote(roadmapFile));
    let currentSet = false;
    for (const p of out.phases) {
      if (p.status === "current" && !currentSet) { p.current = true; currentSet = true; }
    }
    if (!currentSet && hasAnyStatus) { const first = out.phases.find((p) => p.status !== "closed"); if (first) { first.current = true; if (!first.status) first.status = "current"; } }
    let seenCurrent = false;
    for (const p of out.phases) { if (p.current) seenCurrent = true; else if (!p.status && hasAnyStatus) p.status = seenCurrent ? "planned" : "closed"; }
    source("delivery", roadmapFile, rm.how, out.roadmap.shape, { generated, generatedAt });
  } else {
    out.notes.dataQuality.push("No roadmap found — no phases to report.");
  }

  // ------------------------------------------------------------ backlog / status
  const bl = pick("backlog", ["docs/BACKLOG.md", "BACKLOG.md", "*-BACKLOG.md", "STATUS.md", "docs/STATUS.md"]);
  if (bl.files.length) {
    out.backlog = { files: bl.files, counts: { todo: 0, doing: 0, done: 0, blocked: 0 }, blocked: [], ownerBlocked: [] };
    for (const file of bl.files) {
      const text = read(file);
      for (const line of text.split("\n")) {
        const box = line.match(/^\s*- \[([ x])\]\s*(?:\*\*)?([A-Z][\w.-]*-?[\w.]*)?(?:\*\*)?\s*(.*)$/i);
        if (box) {
          const st = box[1].toLowerCase() === "x" ? "done" : /\bblocked\b/i.test(box[3]) && !/\bunblocked\b/i.test(box[3]) ? "blocked" : /\bdoing\b/i.test(box[3]) ? "doing" : "todo";
          out.backlog.counts[st]++;
          if (st === "blocked") out.backlog.blocked.push({ id: box[2] ?? null, text: stripMd(box[3]).slice(0, 140), source: file });
        }
        const ob = line.match(/^\s*-\s+\**([\d.]+|[A-Z][\w.-]+)\**\s*(?:—|-)\s*(.*?)(BLOCKED ON OWNER[^.]*|OWNER CALL[^.]*)/i);
        if (ob && !out.backlog.ownerBlocked.some((x) => x.id === ob[1])) out.backlog.ownerBlocked.push({ id: ob[1], text: stripMd(ob[2]).slice(0, 120), reason: ob[3].trim(), source: file });
      }
      const found = Object.values(out.backlog.counts).some(Boolean) || out.backlog.ownerBlocked.length;
      if (found) source("delivery", file, bl.how, /STATUS/.test(file) ? "generated status (owner-blocked items)" : "checkbox backlog");
    }
    if (!Object.values(out.backlog.counts).some(Boolean) && !out.backlog.ownerBlocked.length) out.backlog = null;
  }

  // ------------------------------------------------------------ changelog
  const cl = pick("changelog", ["CHANGELOG.md", "docs/CHANGELOG.md"]);
  if (cl.files[0]) {
    const text = read(cl.files[0]);
    for (const m of text.matchAll(/^##\s+\[?v?(\d+\.\d+\.\d+[\w.-]*)\]?\s*(?:—|–|-)?\s*(\d{4}-\d{2}-\d{2})?\s*(?:\(([^)]*)\))?/gm)) {
      out.releases.push({ version: m[1], date: m[2] ?? null, summary: m[3] ?? null });
      if (out.releases.length >= 10) break;
    }
    source("momentum", cl.files[0], cl.how, "keep-a-changelog headings");
  }

  // ------------------------------------------------------------ sessions
  const ss = pick("sessions", ["SESSIONS.md", "docs/SESSIONS.md", "docs/SESSION-LOG.md", "**/session-*/**/*.md", "**/*-session.md", "**/*session*.md", "LOOPS.md", "docs/LOOP-STATUS.md", "LOOP-STATUS.md"]);
  for (const file of ss.files.slice(0, 200)) {
    const text = read(file); if (!text) continue;
    if (/LOOP-STATUS|LOOP-LOG|LOOP-METRICS|RESUME|roundtable|LOOPS\.md$/.test(file)) {
      const rows = [...text.matchAll(/^(\d{4}-\d{2}-\d{2}T[\d:Z.+-]+)\s*\|\s*([\w.-]+)\s*\|\s*(done|blocked|failed)\s*\|\s*(\w+)\s*\|\s*gate:\s*(\w+)/gm)];
      for (const r of rows.slice(-20)) out.sessions.push({ id: r[2], date: r[1], title: `${r[2]} ${r[3]} (gate ${r[5]})`, body: "", source: file });
      if (rows.length) source("momentum", file, ss.how, "loop status lines");
      continue;
    }
    if (/SESSIONS?(-LOG)?\.md$/i.test(basename(file))) {
      const blocks = text.split(/\n(?=[A-Z]\d[\w.]*\s*·)/);
      let n = 0;
      for (const b of blocks) { const m = b.match(/^([A-Z][\w.]*)\s*·\s*([^·]+)·\s*([\s\S]*)$/); if (m) { out.sessions.push({ id: m[1].trim(), date: m[2].trim(), title: m[3].replace(/\s+/g, " ").trim().slice(0, 160), body: "", source: file }); n++; } }
      if (!n) for (const e of text.split(/\n(?=##\s+\d{4}-\d{2}-\d{2})/)) { const m = e.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*(?:—|-)\s*(.+?)\s*\n([\s\S]*)$/); if (m) { out.sessions.push({ id: m[1], date: m[1], title: m[2].trim(), body: m[3].replace(/\s+/g, " ").trim().slice(0, 400), source: file }); n++; } }
      if (n) source("momentum", file, ss.how, "session log");
      continue;
    }
    const meta = fm(text);
    const date = meta.created ?? meta.date ?? basename(file).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? file.match(/session-(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    if (!date) continue;
    const title = meta.title ?? text.match(/^#\s+(.+)$/m)?.[1] ?? basename(file, ".md");
    out.sessions.push({ id: basename(file, ".md"), date, title: stripMd(title).slice(0, 160), body: "", source: file });
    source("momentum", dirname(file), ss.how, "per-file session notes");
  }
  out.sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  out.sessions = out.sessions.slice(0, 20);
  if (ss.how === "shape" && out.sessions.length) out.notes.config.push(`sessions found by shape — pin with "sessions" to confirm which files count.`);

  // ------------------------------------------------------------ manual actions
  const ma = pick("manualActions", ["MANUAL-ACTIONS.md", "docs/MANUAL-ACTIONS.md"]);
  for (const file of ma.files) {
    const text = read(file); let group = null;
    for (const line of text.split("\n")) {
      const h = line.match(/^##\s+(.+)$/); if (h) { group = /legend/i.test(h[1]) ? null : stripMd(h[1]); continue; }
      const box = line.match(/^\s*- \[ \]\s*(.+)$/);
      if (box && group) out.manualActions.push({ text: stripMd(box[1]).slice(0, 140), group, source: file });
    }
    source("gates", file, ma.how, "unchecked manual actions");
  }

  // ------------------------------------------------------------ github
  mark("records");
  if (!skipGh) {
    let repos = manifest.github ? [manifest.github] : [];
    if (!repos.length && git) {
      try { const o = sh("git remote get-url origin"); const slug = o.replace(/^git@github\.com:/, "").replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, ""); if (slug.includes("/")) repos = [slug]; } catch { /* none */ }
    }
    for (const slug of repos) {
      const entry = { slug, issues: [], prs: [], error: null };
      try {
        entry.issues = JSON.parse(sh(`gh issue list --repo ${slug} --state open --limit 50 --json number,title,labels,assignees,createdAt`)).map((i) => ({ number: i.number, title: i.title, labels: i.labels.map((l) => l.name), assignees: i.assignees.map((a) => a.login), createdAt: i.createdAt }));
        entry.prs = JSON.parse(sh(`gh pr list --repo ${slug} --state open --limit 50 --json number,title,isDraft,createdAt,updatedAt,author,reviewRequests,statusCheckRollup`)).map((p) => ({
          number: p.number, title: p.title, isDraft: p.isDraft, createdAt: p.createdAt, updatedAt: p.updatedAt, author: p.author?.login ?? null,
          reviewers: (p.reviewRequests ?? []).map((r) => r.login ?? r.name).filter(Boolean),
          checks: summarizeChecks(p.statusCheckRollup),
        }));
        source("delivery", `github:${slug}`, manifest.github ? "manifest" : "origin", "gh issues/prs", { lastChanged: now.toISOString() });
      } catch { entry.error = "gh unavailable or repo inaccessible"; out.warnings.push(`GitHub data missing for ${slug}`); }
      out.github.repos.push(entry);
    }
  }

  // ------------------------------------------------------------ capabilities (opt-in)
  if (manifest.capabilities) {
    const agents = glob([".claude/agents/*.md"]), skills = glob([".claude/skills/*/SKILL.md"]), agentsMd = glob(["AGENTS.md", "**/AGENTS.md"]);
    const lastRelease = out.releases.find((r) => r.date)?.date ?? null;
    let added = new Set();
    if (git && !fast && lastRelease) { try { added = new Set(sh(`git log --since="${lastRelease}" --diff-filter=A --name-only --format=`).split("\n").filter(Boolean)); } catch { /* ignore */ } }
    const item = (f, name) => ({ name, path: f, new: added.has(f) });
    out.capabilities = {
      sinceRelease: lastRelease,
      agents: agents.map((f) => item(f, basename(f, ".md"))),
      skills: skills.map((f) => item(f, basename(dirname(f)))),
      agentsMd: agentsMd.map((f) => item(f, f === "AGENTS.md" ? "root" : dirname(f))),
    };
    source("capabilities", ".claude/agents · .claude/skills · **/AGENTS.md", "manifest", "inventory", { lastChanged: null });
  }

  mark("github");
  // ------------------------------------------------------------ momentum
  const windowStart = new Date(now - 14 * 864e5);
  const ev = (when, what, src, kind) => { const d = toDate(when); if (d && d >= windowStart) out.momentum.events.push({ when: d.toISOString(), what, source: src, kind }); };
  if (git && out.git) {
    try {
      for (const l of sh('git log --since="14 days ago" --format=%cI%x00%s%x00%an --no-merges').split("\n").filter(Boolean).slice(0, 30)) { const [iso, s, a] = l.split("\0"); ev(iso, s, "git", "commit"); }
    } catch { /* ignore */ }
  }
  for (const r of out.releases) ev(r.date, `${r.version}${r.summary ? " — " + r.summary : ""}`, "changelog", "release");
  for (const s of out.sessions) ev(s.date, s.title, s.source, "session");
  for (const d of out.decisions) if (d.since) ev(d.since, `${d.id} ${d.canonical ?? d.status ?? ""} — ${d.title}`, d.source, "decision");
  out.momentum.events.sort((a, b) => b.when.localeCompare(a.when));
  out.momentum.events = out.momentum.events.slice(0, 25);
  if (out.git) out.momentum.cadence = { commitsLast14: out.git.commitsLast14, commitsPrior14: out.git.commitsPrior14 };

  // ------------------------------------------------------------ human items (ranked)
  const age = (d) => { const x = toDate(d); return x ? daysBetween(x, now) : null; };
  const H = [];
  for (const g of out.gates) if (g.status !== "closed") H.push({ kind: "gate", severity: 3, id: g.id, title: g.title, owner: g.owner, blocks: "phase exit", ageDays: age(g.raised), meta: g.checklist ? `${g.checklist.done}/${g.checklist.total} checked` : null, source: g.source });
  // parked/deferred questions are not waiting on anyone right now
  for (const q of out.openQuestions) if (q.canonical !== "closed" && !/^(parked|deferred)/i.test(q.status ?? "")) H.push({ kind: "question", severity: q.blocks ? 2.5 : 2, id: q.id, title: q.question, owner: q.owner, blocks: q.blocks, ageDays: age(q.raised), source: q.source });
  for (const n of out.otherNodes.needsHuman) H.push({ kind: "node", severity: 2.5, id: n.id, title: n.title, owner: "Human", blocks: n.status, ageDays: null, source: n.source });
  for (const d of out.decisions) if (d.canonical === "proposed") H.push({ kind: "decision", severity: 2, id: d.id, title: d.title, owner: d.owner, blocks: null, ageDays: age(d.since), source: d.source });
  for (const r of out.github.repos) for (const p of r.prs) if (!p.isDraft && p.checks === "passing") H.push({ kind: "pr", severity: 2.2, id: `#${p.number}`, title: p.title, owner: p.reviewers[0] ?? null, blocks: "merge", ageDays: age(p.updatedAt), meta: "CI passing, unmerged", source: `github:${r.slug}` });
  for (const b of out.backlog?.ownerBlocked ?? []) H.push({ kind: "owner-call", severity: 2.5, id: b.id, title: b.text, owner: "Owner", blocks: b.reason, ageDays: null, source: b.source });
  for (const m of out.manualActions) H.push({ kind: "manual", severity: 1, id: null, title: m.text, owner: m.group, blocks: null, ageDays: null, source: m.source });
  for (const h of H) h.owner = h.owner ? stripMd(h.owner) : "Unassigned";
  H.sort((a, b) => b.severity - a.severity || (b.ageDays ?? -1) - (a.ageDays ?? -1));
  out.humanItems = H;

  // ------------------------------------------------------------ staleness
  const quiet = manifest.staleness?.quietDays ?? 7, stalled = manifest.staleness?.stalledDays ?? 14;
  if (out.git) {
    const a = out.git.ageDays, open = H.length > 0;
    out.staleness = { ageDays: a, openHumanItems: H.length, thresholds: { quietDays: quiet, stalledDays: stalled }, verdict: a < quiet ? "active" : a <= stalled ? "quiet" : open ? "stalled" : "dormant" };
  }

  // ------------------------------------------------------------ closing notes
  const phaseRefs = new Set();
  for (const r of out.github.repos) for (const i of r.issues) for (const l of i.labels) { const m = l.match(/^phase:(\S+)$/i); if (m) phaseRefs.add(m[1].toUpperCase()); }
  for (const ref of phaseRefs) if (out.phases.length && !out.phases.some((p) => p.id.replace(/-/g, "") === ref.replace(/-/g, ""))) out.notes.dataQuality.push(`Issues reference phase "${ref}", which ${roadmapFile ?? "the roadmap"} does not define.`);
  if (!out.decisions.length && !out.roadmap && !out.openQuestions.length && !out.gates.length) out.warnings.push("No decision or roadmap records found — this project records only git/GitHub state. Publish a thin page and say so.");
  if (!existsSync(join(repoPath, ".claude/progress.json"))) out.notes.config.push("No .claude/progress.json — everything above was shape-detected. See references/manifest.md.");

  // ------------------------------------------------------------ stakeholder view (opt-in; absent → the engineer output is unchanged)
  const audience = manifest.audience ?? "engineer";
  if (audience === "stakeholder") out.stakeholder = stakeholderView({ manifest, out, read, gitOut, source, now, git, fast, roadmapFile, changelogFile: cl.files[0] ?? null });
  else {
    if (audience !== "engineer") out.notes.config.push(`"audience": ${JSON.stringify(audience)} is neither "engineer" nor "stakeholder" — the engineer page is used.`);
    const only = ["exitCriteria", "plain", "activity"].filter((k) => manifest[k] !== undefined);
    if (only.length) out.notes.config.push(`${only.map((k) => `"${k}"`).join(", ")} ${only.length > 1 ? "are" : "is"} read only when "audience" is "stakeholder".`);
  }

  mark("derive");
  out.mode = fast ? "fast" : "full";
  out.timings = { ...timings, totalMs: Date.now() - t0, filesScanned: allFiles.length };
  return out;
}

function summarizeChecks(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) return null;
  const states = rollup.map((c) => c.conclusion || c.state).filter(Boolean);
  if (states.some((s) => /FAILURE|ERROR|TIMED_OUT/i.test(s))) return "failing";
  if (states.some((s) => /PENDING|IN_PROGRESS|QUEUED/i.test(s))) return "pending";
  if (states.every((s) => /SUCCESS|NEUTRAL|SKIPPED/i.test(s))) return "passing";
  return "unknown";
}

// ---------------------------------------------------------------- stakeholder view
// What the stakeholder page needs, already joined. The page shows no ids, codes or file names, so every
// item carries its raw text and the owner's plain wording from the manifest's "plain" glossary (or null,
// in which case it is also listed in wordingPending for the terminal summary).
function stakeholderView({ manifest, out, read, gitOut, source, now, git, fast, roadmapFile, changelogFile }) {
  const dq = (s) => out.notes.dataQuality.push(s);
  const plainCfg = isObj(manifest.plain) ? manifest.plain : {};
  if (manifest.plain !== undefined && !isObj(manifest.plain)) out.notes.config.push(`"plain" is not an object — no plain wording used.`);
  for (const g of ["phases", "steps", "criteria"]) if (plainCfg[g] !== undefined && !isObj(plainCfg[g])) out.notes.config.push(`"plain.${g}" is not an object — ignored.`);
  const say = (group, keys) => { const m = isObj(plainCfg[group]) ? plainCfg[group] : {}; for (const k of keys) { const v = m[k]; if (typeof v === "string" && v.trim()) return v.trim(); } return null; };
  const wordingPending = [];
  const need = (kind, key, text, plain) => { if (!plain) wordingPending.push({ kind, key, text }); return plain; };

  // exit criteria (format B) — a missing or invalid file is a data-quality note, never a crash
  const ecPath = typeof manifest.exitCriteria === "string" && manifest.exitCriteria ? manifest.exitCriteria : null;
  const exitCriteria = { file: ecPath, loaded: false, error: null, overall: null };
  let ec = null;
  if (ecPath) {
    let raw = null, problem = null, parsed = null;
    try { raw = read(ecPath); } catch (e) { problem = `it cannot be read (${e.code ?? e.message})`; } // a directory, no permission
    if (!problem && raw == null) problem = "the file does not exist";
    if (!problem) { try { parsed = JSON.parse(raw); } catch (e) { problem = `it is not valid JSON (${e.message})`; } }
    if (!problem) { const errs = validateExitCriteria(parsed); if (errs.length) problem = errs.slice(0, 3).join("; ") + (errs.length > 3 ? `; and ${errs.length - 3} more` : ""); }
    if (problem) { exitCriteria.error = problem; dq(`exitCriteria ${ecPath}: ${problem} — exit checks not shown; phases come from the roadmap.`); }
    else { ec = parsed; exitCriteria.loaded = true; exitCriteria.overall = ec.overall; }
    if (raw != null) source("delivery", ecPath, "manifest", ec ? "exit-criteria json v1" : "exit-criteria json (invalid)");
  } else if (manifest.exitCriteria !== undefined) out.notes.config.push(`"exitCriteria" is not a repo-relative path — ignored; the stakeholder page shows steps but no exit checks.`);
  else out.notes.config.push(`No "exitCriteria" in .claude/progress.json — the stakeholder page shows steps but no exit checks.`);

  // phases: from the exit criteria when loaded, else from the roadmap (whose headings may end "— met" / "— current")
  const TAIL = /\s+(?:—|–|-)\s+(met|not met|done|closed|complete|current|active|in progress|next|planned)\s*$/i;
  const tailState = (w) => (/^(met|done|closed|complete)$/i.test(w) ? "done" : /^(current|active|in progress)$/i.test(w) ? "now" : "next");
  const phases = ec
    ? [...ec.phases].sort((a, b) => a.number - b.number).map((p) => ({ id: p.id, number: p.number, title: p.title, state: EC_STATUS[p.status], ec: p }))
    : out.phases.map((p) => {
      const tail = p.title.match(TAIL), n = p.id.match(/\d+/)?.[0];
      const state = p.current ? "now" : p.status === "closed" ? "done" : p.status ? "next" : tail ? tailState(tail[1]) : null;
      return { id: p.id, number: n != null ? Number(n) : null, title: tail ? p.title.slice(0, tail.index) : p.title, state };
    });
  let ci = phases.findIndex((p) => p.state === "now");
  if (ci < 0 && phases.some((p) => p.state)) {
    ci = phases.findIndex((p) => p.state !== "done");
    if (ci >= 0) { phases[ci].state = "now"; if (ec) dq(`exitCriteria ${ecPath} marks no phase current — the first unmet one is shown as now.`); }
  }
  phases.forEach((p, i) => { if (i !== ci && p.state === "now") p.state = "next"; if (!p.state && ci >= 0) p.state = i < ci ? "done" : "next"; });
  const cur = ci >= 0 ? phases[ci] : null;
  // The engineer note says the roadmap cannot give the current phase; here it was found (exit criteria or a "— current" tail), so the note would contradict the page.
  if (cur && roadmapFile) { const i = out.notes.dataQuality.indexOf(noMarkersNote(roadmapFile)); if (i >= 0) out.notes.dataQuality.splice(i, 1); }
  if (!cur) dq(!phases.length ? "No phases found — the stakeholder page has no journey." : phases.every((p) => p.state === "done") ? "Every phase is done — there is no current phase." : "The current phase cannot be determined — the stakeholder headline has no phase.");
  const numbers = phases.map((p) => p.number).filter((n) => n != null);
  const phaseKeys = (p) => [...new Set([p.id, String(p.id).toLowerCase(), p.number != null ? `phase${p.number}` : null, p.number != null ? String(p.number) : null].filter(Boolean))];
  const journey = phases.map((p) => ({ id: p.id, number: p.number, title: p.title, state: p.state, plain: need("phase", ec || p.number == null ? p.id : `phase${p.number}`, p.title, say("phases", phaseKeys(p))) }));

  // steps: the current phase's work-items table in the roadmap, with its Status column
  let steps = [], stepsProblem = null;
  if (cur) {
    if (!roadmapFile) stepsProblem = "no roadmap";
    else if (cur.number == null) stepsProblem = "the current phase has no number";
    else { const sec = phaseSection(read(roadmapFile), cur.number); if (sec == null) stepsProblem = `no "Phase ${cur.number}" heading`; else ({ steps, problem: stepsProblem } = parseStepTable(sec)); }
    if (stepsProblem) dq(`${roadmapFile ?? "Roadmap"}: ${stepsProblem} for the current phase — steps not shown.`);
  }
  for (const s of steps) if (!s.status) dq(`${roadmapFile} Phase ${cur.number} step ${s.number}: status "${s.statusRaw}" is not done, in progress or not started — counted as unknown.`);
  const stepList = steps.map((s) => { const key = `${cur.number}.${s.number}`; return { key, number: s.number, name: s.name, status: s.status, statusRaw: s.statusRaw, plain: need("step", key, s.name, say("steps", [key])) }; });
  const stepCounts = { done: 0, "in progress": 0, "not started": 0, unknown: 0 };
  for (const s of stepList) stepCounts[s.status ?? "unknown"]++;

  // exit checks for the current phase: rows at target (never a percentage), manual checks apart
  let exitChecks = null;
  if (cur?.ec) {
    const { rows, manual } = cur.ec;
    exitChecks = {
      atTarget: rows.filter((r) => r.atTarget).length, total: rows.length,
      manualDone: manual.filter((m) => m.done).length, manualTotal: manual.length,
      notAtTarget: rows.filter((r) => !r.atTarget).map((r) => ({ id: r.id, title: r.title, level: r.level, target: r.target, note: r.note, plain: need("criterion", r.id, r.title, say("criteria", [r.id])) })),
      manualOpen: manual.filter((m) => !m.done).map((m) => m.title),
    };
  }

  // milestones and the activity word: dated CHANGELOG entries, not commits
  const ms = changelogFile ? parseMilestones(read(changelogFile)) : [];
  if (!changelogFile) dq("No CHANGELOG — the stakeholder page has no recent milestones and no activity word.");
  else if (!ms.length) dq(`${changelogFile} has no dated entries — no recent milestones and no activity word.`);
  const act = isObj(manifest.activity) ? manifest.activity : {};
  const thresholds = { quietDays: Number.isFinite(act.quietDays) ? act.quietDays : 14, stalledDays: Number.isFinite(act.stalledDays) ? act.stalledDays : 30 };
  const today = ymd(now), last = ms[0]?.date ?? null;
  const days = last ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 864e5) : null;
  const activity = { word: activityWord(days, thresholds), lastMilestone: last, daysSinceMilestone: days, thresholds };

  // key decisions: the latest accepted ones, dated from the record, else from git (one decision per file only)
  const idNum = (id) => Number(id.match(/(\d+)$/)?.[1] ?? -1);
  const accepted = out.decisions.filter((d) => d.canonical === "accepted").map((d) => {
    let date = /^\d{4}-\d{2}-\d{2}/.test(d.since ?? "") ? d.since.slice(0, 10) : null, dateFrom = date ? "record" : null;
    if (!date && git && !fast && d.source && basename(d.source).toUpperCase().startsWith(d.id.toUpperCase())) {
      try { const first = gitOut(["log", "--diff-filter=A", "--format=%cs", "--", d.source]).split("\n").filter(Boolean).at(-1); if (first) { date = first; dateFrom = "git"; } } catch { /* no history */ }
    }
    return { id: d.id, title: d.title, date, dateFrom };
  });
  accepted.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || idNum(b.id) - idNum(a.id));

  // blockers: waiting on people and blocking the current phase — open gates, owner calls, needs-human nodes, or anything naming the phase.
  // An item whose title or "blocks" names only other phases ("Phase 3: the regulator signs off the launch") waits for a later phase, not this one.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ref = cur ? new RegExp([cur.number != null ? `\\bphase[\\s-]*${cur.number}(?!\\d)` : null, `\\b${esc(cur.id)}\\b`].filter(Boolean).join("|"), "i") : null;
  const otherPhaseOnly = (h) => { if (cur.number == null) return false; const n = [...phaseNumbersIn(h.title), ...phaseNumbersIn(h.blocks)]; return n.length > 0 && !n.includes(cur.number); };
  const blockers = cur ? out.humanItems.filter((h) => (["gate", "owner-call", "node"].includes(h.kind) || ref.test(h.blocks ?? "")) && !otherPhaseOnly(h)).map((h) => ({ kind: h.kind, title: h.title, owner: h.owner, blocks: h.blocks, ageDays: h.ageDays })) : [];

  return {
    title: typeof manifest.title === "string" && manifest.title.trim() ? manifest.title.trim() : out.project,
    headline: {
      phase: cur ? { number: cur.number, of: numbers.length ? Math.max(...numbers) : null, title: cur.title, plain: journey[ci].plain } : null,
      steps: { done: stepCounts.done, total: stepList.length },
      activity: activity.word,
      updated: today,
    },
    journey,
    thisPhase: cur ? { id: cur.id, number: cur.number, title: cur.title, plain: journey[ci].plain, steps: stepList, stepCounts, exitChecks } : null,
    milestones: ms.slice(0, 5),
    decisions: accepted.slice(0, 5),
    activity,
    blockers,
    exitCriteria,
    wordingPending,
  };
}

// ---------------------------------------------------------------- self-test
function selfTest() {
  const root = join(HERE, "..", "fixtures");
  let failed = 0, total = 0;
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
  const check = (name, dir, expect) => {
    let state, bad = 0;
    // "$now" in expect.json pins the clock (the stakeholder activity word counts days); "$" keys are options, not assertions
    try { state = collect(dir, { noGh: true, git: false, selfTest: true, ...(expect.$now ? { now: expect.$now } : {}) }); } catch (e) { console.log(`✗ ${name}: collector threw ${e.stack}`); failed++; total++; return; }
    for (const [path, want] of Object.entries(expect)) {
      if (path.startsWith("$")) continue;
      total++;
      const got = get(state, path);
      const ok = typeof want === "object" && want !== null ? JSON.stringify(got) === JSON.stringify(want) : got === want;
      if (!ok) { failed++; bad++; console.log(`✗ ${name}: ${path}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`); }
    }
    console.log(`${bad ? "·" : "✓"} ${name}`);
  };
  const pinned = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const expectFile = join(dir, "expect.json");
    if (!existsSync(expectFile)) { console.log(`~ ${name}: no expect.json`); continue; }
    const expect = JSON.parse(readFileSync(expectFile, "utf8"));
    check(name, dir, expect);
    if (expect.$now) pinned.push([name, dir, expect]);
  }
  // A pinned clock must give the same answers in every time zone: rerun those fixtures at both ends of the clock (UTC+14, UTC−12).
  const tz0 = process.env.TZ;
  for (const tz of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
    process.env.TZ = tz;
    for (const [name, dir, expect] of pinned) check(`${name} @ ${tz}`, dir, expect);
  }
  if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0;

  // No shell: a decision file and an exit-criteria file whose names hold "$(touch …)" in a real git repo, full mode.
  const shellCase = (() => {
    if (process.platform === "win32") return null; // "$(…)" is not a valid Windows file name
    const dir = mkdtempSync(join(tmpdir(), "progress-dashboard-"));
    try {
      mkdirSync(join(dir, ".claude")); mkdirSync(join(dir, "bench")); mkdirSync(join(dir, "docs", "decisions"), { recursive: true });
      writeFileSync(join(dir, ".claude", "progress.json"), JSON.stringify({ audience: "stakeholder", exitCriteria: "bench/$(touch PWNED-2).json" }));
      writeFileSync(join(dir, "bench", "$(touch PWNED-2).json"), "{}");
      writeFileSync(join(dir, "docs", "decisions", "ADR-0001-$(touch PWNED-1).md"), "# ADR-0001 One repo\n\n## Status\n\nAccepted\n");
      const g = (...a) => execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...a], { cwd: dir, stdio: "ignore" });
      try { g("init", "-q"); g("add", "-A"); g("commit", "-q", "--no-verify", "-m", "fixture"); } catch { return null; }
      const s = collect(dir, { noGh: true, selfTest: true });
      return [
        ["no shell: a decision file named with $(…)", existsSync(join(dir, "PWNED-1")), false],
        ["no shell: an exit-criteria path with $(…)", existsSync(join(dir, "PWNED-2")), false],
        ["decision dated from the commit that added it", s.stakeholder?.decisions?.[0]?.dateFrom, "git"],
      ];
    } finally { rmSync(dir, { recursive: true, force: true }); }
  })();
  if (!shellCase) console.log("~ no-shell check skipped (no git, or Windows)");

  // boundaries no single fixture can hold at once
  const t = { quietDays: 14, stalledDays: 30 };
  const units = [
    ["activity: 13 days is Moving", activityWord(13, t), "Moving"],
    ["activity: 14 days is Quiet", activityWord(14, t), "Quiet"],
    ["activity: 30 days is Quiet", activityWord(30, t), "Quiet"],
    ["activity: 31 days is Stalled", activityWord(31, t), "Stalled"],
    ["activity: no milestone, no word", activityWord(null, t), null],
    ["exitCriteria: version 2 refused", validateExitCriteria({ version: 2, overall: 1, phases: [] })[0], "version is 2, expected 1"],
    ["exitCriteria: minimal valid", validateExitCriteria({ version: 1, overall: 0, phases: [{ id: "p0", number: 0, title: "t", status: "current", rows: [], manual: [] }] }).length, 0],
    ["milestones: undated skipped, versions read", JSON.stringify(parseMilestones("## [Unreleased]\n## [1.2.0] — 2026-08-27 (summary)\n## 1.1.0 (2026-08-01)\n## [1.0.0](https://example.com/v1) - 2026-07-01\n")), JSON.stringify([{ date: "2026-08-27", heading: "summary", version: "1.2.0" }, { date: "2026-08-01", heading: null, version: "1.1.0" }, { date: "2026-07-01", heading: null, version: "1.0.0" }])],
    ["exitCriteria: inherited status name refused", validateExitCriteria({ version: 1, overall: 0, phases: [{ id: "p0", number: 0, title: "t", status: "toString", rows: [], manual: [] }] }).length, 1],
    ["phase numbers: every form read", JSON.stringify(phaseNumbersIn("Phase 3: sign-off; phase-1 and phase12, not phase exit")), JSON.stringify([3, 1, 12])],
    ...(shellCase ?? []),
  ];
  let unitFailed = 0;
  for (const [label, got, want] of units) { total++; if (got !== want) { failed++; unitFailed++; console.log(`✗ ${label}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`); } }
  console.log(`${unitFailed ? "·" : "✓"} stakeholder helpers`);
  console.log(`\n${total - failed}/${total} assertions passed`);
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------- cli
const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const repoPath = args.find((a) => !a.startsWith("--")) ?? process.cwd();
    const state = collect(repoPath, { noGh: args.includes("--no-gh"), fast: args.includes("--fast") });
    if (!args.includes("--json-only") && state.notes.config.length) process.stderr.write("config notes:\n" + state.notes.config.map((n) => "  - " + n).join("\n") + "\n");
    if (args.includes("--profile")) process.stderr.write(`profile (${state.mode}): ` + Object.entries(state.timings).map(([k, v]) => `${k}=${v}${k.endsWith("Ms") || !/files/.test(k) ? "ms" : ""}`).join(" ") + "\n");
    process.stdout.write(JSON.stringify(state, null, 2));
  }
}
