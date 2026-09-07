#!/usr/bin/env node
// progress-dashboard collector.
//
// Reads a project's records — decisions, questions, gates, roadmap, backlog,
// changelog, sessions, manual actions, git, GitHub — and emits one JSON blob.
// Deterministic: no judgement here. Discovery is manifest-first
// (.claude/progress.json), shape-detection second. Never runs a command the
// manifest did not declare.
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

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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

  const now = new Date();
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
    if (git && !fast) { try { const iso = sh(`git log -1 --format=%cI -- "${p}"`); if (iso) return iso; } catch { /* fall through */ } }
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

  // Shape 5 — decision-session yaml (busy-office-erp): items with status pending are open questions
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
    if (out.phases.length && !hasAnyStatus) out.notes.dataQuality.push(`${roadmapFile} carries no phase status markers — current phase cannot be determined from it.`);
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
    if (/LOOP-STATUS|LOOPS\.md$/.test(file)) {
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

// ---------------------------------------------------------------- self-test
function selfTest() {
  const root = join(HERE, "..", "fixtures");
  let failed = 0, total = 0;
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const expectFile = join(dir, "expect.json");
    if (!existsSync(expectFile)) { console.log(`~ ${name}: no expect.json`); continue; }
    const expect = JSON.parse(readFileSync(expectFile, "utf8"));
    let state;
    try { state = collect(dir, { noGh: true, git: false, selfTest: true }); } catch (e) { console.log(`✗ ${name}: collector threw ${e.stack}`); failed++; total++; continue; }
    for (const [path, want] of Object.entries(expect)) {
      total++;
      const got = get(state, path);
      const ok = typeof want === "object" && want !== null ? JSON.stringify(got) === JSON.stringify(want) : got === want;
      if (!ok) { failed++; console.log(`✗ ${name}: ${path}\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`); }
    }
    console.log(`${failed ? "·" : "✓"} ${name}`);
  }
  console.log(`\n${total - failed}/${total} assertions passed`);
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------- cli
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
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
