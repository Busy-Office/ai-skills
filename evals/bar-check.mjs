#!/usr/bin/env node
// Mechanical pre-check for a gauntlet artifact.
//
//   node evals/bar-check.mjs <skill> <artifact.md> [--collector run.json] [--target repo]
//   node evals/bar-check.mjs <skill> <artifact.md> --pack out.md ...   # evidence pack
//   node evals/bar-check.mjs --self-test
//
// With --collector it also cross-checks the artifact's headline figures against
// a fresh collector run. A stale number is the one defect a careful writer
// still makes and a critic has to catch by hand — this catches it for free.
//
// It measures only what a machine can measure exactly — word counts, section
// presence, row shape, list length. Everything else is the critic's job, and
// the critic must not treat a green pre-check as a pass: an artifact can be
// perfectly shaped and still say nothing true.
//
// Run this BEFORE the critic. It makes the cheap failures cheap.
//
// --pack writes everything a critic needs into one file: the artifact, the
// class's criteria, the mechanical results, the collector fields the bar cares
// about, and every cited line pulled from the target. A subagent's bill is the
// sum of its context at each turn, so a critic that reads one file in one turn
// costs a fraction of one that explores for ten. Put the pack first in the
// prompt and the brief last: the stable prefix is what a cache can reuse across
// a batch of critics.

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Per-skill shape. Keep these in step with each BAR.md — the bar is the
// authority, this file is the instrument.
export const SPECS = {
  "loop-doctor": {
    proseMax: 450, leadMax: 60, doNextMax: 5,
    opensWith: "diagram",
    sections: [/^#+\s*score/im, /^#+\s*(findings|invalid|redundant|risk)/im, /^#+\s*do next/im],
    citedTables: [/invalid|redundant|risk/i],
  },
  "loop-economist": {
    proseMax: 400, leadMax: 60, doNextMax: 5,
    opensWith: "table",
    sections: [/^#+\s*the economics/im, /^#+\s*score/im, /^#+\s*findings/im],
    citedTables: [/leak|misroute|no-converge|ill-formed/i],
    sessionsLocate: true,   // a run's evidence is a session id, not a file:line
    requireVerdict: /\b(compounding|productive|expensive|spinning)\b/i,
    requireCaps: /\bcap(s|ped|ping)?\b/i,
    figures: { "commits": "derived.commits", "sessions": "derived.sessions", "tokens per commit": "derived.tokensPerCommit" },
  },
  "requeue": {
    proseMax: 350, leadMax: 50, doNextMax: 5,
    opensWith: "table",
    sections: [/^#+\s*health of the queue/im, /^#+\s*proposed order/im, /^#+\s*hygiene/im],
    citedTables: [/duplicate|contradiction|ghost|stale/i],
    figures: { "open items": "summary.open", "acceptance share": "summary.acceptanceShare" },
    requireLanes: /\b(loop|subloop|gauntlet|human|blocked)\b/i,
  },
  "sharpen-intent": {
    proseMax: 350, leadMax: 50, doNextMax: 5,
    opensWith: "table",
    sections: [/^#+\s*where purpose is stated/im, /^#+\s*score/im, /^#+\s*the draft/im],
    citedTables: [],
    locatedSection: /does the work trace back/,
    requireVerdict: /\b(steering|usable|decorative|absent)\b/i,
    requireCaps: /\bcap(s|ped|ping)?\b/i,
    figures: { "open items": "traceability.openItems", "traced": "traceability.traced" },
  },
  "wake-weight": {
    proseMax: 300, leadMax: 40, doNextMax: 3,
    opensWith: "table",
    sections: [/^#+\s*what is loaded/im, /^#+\s*the cuts/im, /^#+\s*what not to cut/im],
    citedTables: [],
    locatedSection: /what is loaded/,
    figures: { "per-tick tokens": "summary.provenTokensEst", "window cost": "summary.windowCostEst", "90-day projection": "summary.projectedIn90d" },
  },
  "loop-atlas": {
    proseMax: 400, leadMax: 60, doNextMax: 5,
    opensWith: "diagram",
    sections: [/^#+\s*the flow/im, /^#+\s*the crew/im],
    citedTables: [],
    locatedSection: /the flow/,
  },
};

// What counts as "located". A finding must be checkable by someone who has
// only the artifact and the target: a file:line, the session it happened in,
// or — for an absence — the place the missing rule should have lived.
const FILE_LINE = /[\w./-]+\.(md|mjs|js|ts|tsx|py|sh|ps1|ya?ml|json|toml|plist|html|css)(:\d+)?/i;
// Ids are usually written as code, so allow the backticks/quotes around them.
const SESSION = /\b(s-[0-9a-f]{3,}|sessions?\s+[`'"]?[\w-]{4,}|\d+\s+(sessions?|runs?|commits?|summons?))\b/i;
const ABSENCE = /\b(none|no evidence|vacant|not measured|absent|nowhere|never|no \w+ (step|ran|exists|found|in)|— *—)\b/i;
const HEDGE = /\b(consider(ing)?|maybe|perhaps|might want|could be improved|as appropriate|where possible|etc\.)\b/i;

function blocks(md) {
  const lines = md.split("\n");
  const out = { prose: [], tableRows: [], headings: [], fenced: [], html: [] };
  let inFence = false, inHtml = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) { out.fenced.push(line); continue; }
    if (/^\s*<(svg|div|table)\b/i.test(line)) inHtml = true;
    if (inHtml) { out.html.push(line); if (/<\/(svg|div|table)>/i.test(line)) inHtml = false; continue; }
    if (/^\s*\|/.test(line)) { out.tableRows.push(line); continue; }
    if (/^\s*#{1,6}\s/.test(line)) { out.headings.push(line); continue; }
    if (line.trim()) out.prose.push(line);
  }
  return out;
}

function words(lines) {
  return lines
    .join(" ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[*_>#\-–—·|]/g, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

// Data rows under one heading — for the classes whose evidence table is not a
// findings table (sharpen-intent traces items, loop-atlas locates stages).
function rowsUnder(md, headingRe) {
  const m = md.match(new RegExp(`^#+\\s*${headingRe.source}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,6}\\s|\\n---|(?![\\s\\S]))`, "im"));
  return m ? dataRows(m[1].split("\n").filter((l) => /^\s*\|/.test(l))) : [];
}

function dataRows(tableLines) {
  return tableLines.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l) && (l.match(/\|/g) ?? []).length >= 2);
}

// How a number is legitimately written in prose: raw, grouped, k, M, or a rate.
function renderings(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return [];
  const out = new Set([String(n)]);
  out.add(n.toLocaleString("en-US"));
  out.add(n.toLocaleString("en-US").replace(/,/g, " "));
  out.add(n.toLocaleString("en-US").replace(/,/g, "\u202f"));
  if (n >= 1000) { out.add(`${Math.round(n / 1000)}k`); out.add(`${(n / 1000).toFixed(1)}k`); }
  if (n >= 1e6) { out.add(`${Math.round(n / 1e6)}M`); out.add(`${(n / 1e6).toFixed(1)}M`); out.add(`${(n / 1e6).toFixed(2)}M`); }
  if (n < 10) { out.add(n.toFixed(2)); out.add(n.toFixed(1)); }
  return [...out].filter(Boolean);
}

export function barCheck(skill, md, collector = null, target = null) {
  const spec = SPECS[skill];
  if (!spec) throw new Error(`no spec for skill: ${skill}`);
  const b = blocks(md);
  const rows = [];
  const add = (id, what, evidence, pass) => rows.push({ id, what, evidence, verdict: pass ? "PASS" : "FAIL" });

  // M1 — prose budget
  const prose = words(b.prose);
  add("M1", `prose ≤ ${spec.proseMax} words`,
    prose <= spec.proseMax
      ? `${prose} words outside tables, diagrams and code`
      : `${prose} words — cut ${prose - spec.proseMax}`,
    prose <= spec.proseMax);

  // M2 — the lede, and what opens the artifact
  const afterTitle = md.replace(/^#[^\n]*\n/, "");
  const firstFence = afterTitle.search(/^\s*```/m);
  const firstTable = afterTitle.search(/^\s*\|/m);
  const firstBlock = [firstFence, firstTable].filter((n) => n >= 0).sort((a, b2) => a - b2)[0] ?? -1;
  const lead = firstBlock < 0 ? words(b.prose) : words(afterTitle.slice(0, firstBlock).split("\n"));
  add("M2", `lede ≤ ${spec.leadMax} words`, `${lead} words before the first ${spec.opensWith}`, lead <= spec.leadMax);

  const opener = spec.opensWith === "diagram"
    ? /```mermaid|<svg/i.test(afterTitle.slice(0, Math.max(firstBlock, 0) + 400))
    : firstBlock >= 0;
  add("M3", `opens with a ${spec.opensWith}`, opener ? "found within the first block" : "not found", opener);

  // M4 — required sections
  const missing = spec.sections.filter((re) => !re.test(md));
  add("M4", "required sections present", missing.length ? `missing ${missing.length}: ${missing.map(String).join(" ")}` : `all ${spec.sections.length} present`, !missing.length);

  // M5 — every finding row is located and classified.
  // A finding row is one with an id in its first cell (F1, H3) — that is the
  // convention every report template uses, and it keeps summary rows like
  // "duplicates / contradictions | 1 / 1" out of the count.
  const finding = spec.citedTables.length
    ? dataRows(b.tableRows).filter((l) => /^\s*\|\s*(\*\*)?[A-Z]{1,2}\d{1,2}(\*\*)?\s*\|/.test(l))
    : rowsUnder(md, spec.locatedSection).slice(1);   // drop the header row
  const locators = [FILE_LINE, ABSENCE, ...(spec.sessionsLocate ? [SESSION] : [])];
  const uncited = finding.filter((l) => !locators.some((re) => re.test(l)));
  add("M5", "every finding row carries a file:line, a session, or a located absence",
    finding.length ? `${finding.length} evidence rows, ${uncited.length} without a location` : "no evidence rows found — the table is missing",
    finding.length > 0 && uncited.length === 0);

  // M5b — findings use the class vocabulary this skill defines
  if (spec.citedTables.length) {
    const unclassed = finding.filter((l) => !spec.citedTables.some((re) => re.test(l)));
    add("M5b", "every finding row names a class from the fixed set",
      `${finding.length - unclassed.length} of ${finding.length} classified`, unclassed.length === 0);
  }

  // M6 — do-next length
  const doNext = (md.match(/^#+\s*(do next|what the numbers say to do|to decide)[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|\n---|(?![\s\S]))/im)?.[2] ?? "");
  const items = (doNext.match(/^\s*(\d+\.|[-*])\s+/gm) ?? []).length;
  add("M6", `do-next ≤ ${spec.doNextMax} items`, items ? `${items} items` : "section not found", items > 0 && items <= spec.doNextMax);

  // M7 — the receipt
  const receipt = /(read|inspected)\s+\d+[^\n]*(untouched|read-only|not written)/i.test(md) || /target repo untouched/i.test(md);
  add("M7", "footer receipt with a count and 'untouched'", receipt ? "found" : "absent", receipt);

  // M8 — the fixed verdict vocabulary, where the class has one
  if (spec.requireVerdict) {
    const m = md.match(spec.requireVerdict);
    add("M8", "verdict from the fixed set", m ? `“${m[0]}”` : "no verdict word found", !!m);
  }
  if (spec.requireLanes) {
    const laneRows = dataRows(b.tableRows).filter((l) => spec.requireLanes.test(l)).length;
    add("M8", "items carry a lane", `${laneRows} rows name a lane`, laneRows > 0);
  }

  // M13 — every file:line the artifact cites actually exists, at that line.
  // Critics were spending tool calls opening four citations "at random"; a
  // script opens all of them for nothing, and a turn not taken is the whole
  // saving — a subagent's bill is the sum of its context at each turn.
  if (target) {
    const cites = [...new Set([...md.matchAll(/`?([\w./-]+\.(?:md|mjs|js|ts|tsx|py|sh|ps1|ya?ml|json|toml|astro|css|html))(?::(\d+))?`?/g)]
      .map((m) => ({ file: m[1], line: m[2] ? Number(m[2]) : null }))
      .filter((c) => !c.file.startsWith("evals/") && c.file.includes("."))
      .map((c) => JSON.stringify(c)))].map((x) => JSON.parse(x));
    // A citation may be written in full once and by basename afterwards, which
    // is ordinary prose rather than a bad reference — resolve it the way a
    // reader would before failing it.
    let tree = null;
    const resolve = (rel) => {
      const direct = join(target, rel);
      if (existsSync(direct)) return direct;
      if (tree === null) {
        tree = [];
        const skip = new Set(["node_modules", ".git", "dist", "build", "worktrees", ".next", "coverage"]);
        const walk = (d, depth) => {
          if (depth > 5) return;
          let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
          for (const e of ents) {
            if (e.isDirectory()) { if (!skip.has(e.name)) walk(join(d, e.name), depth + 1); }
            else tree.push(join(d, e.name));
          }
        };
        walk(target, 0);
      }
      const base = rel.split("/").pop();
      return tree.find((f) => f.endsWith("/" + rel)) ?? tree.find((f) => f.endsWith("/" + base)) ?? null;
    };
    const bad = [];
    for (const c of cites) {
      const p2 = resolve(c.file);
      if (!p2) { bad.push(`${c.file} (no such file)`); continue; }
      if (c.line != null) {
        const n = readFileSync(p2, "utf8").split("\n").length;
        if (c.line > n) bad.push(`${c.file}:${c.line} (file has ${n} lines)`);
      }
    }
    if (cites.length) {
      add("M13", "every cited file:line exists in the target",
        bad.length ? `${bad.length} of ${cites.length} bad: ${bad.slice(0, 3).join(", ")}` : `all ${cites.length} citations resolve`,
        bad.length === 0);
    }
  }

  // M12 — an interval claim is almost always the denominator of a cost
  // argument. If the artifact states one, it must cite where it comes from or
  // say it is unknown. An invented cadence makes every derived figure wrong.
  const cadenceClaim = md.match(/\b(\d+)[- ]?(?:minute|min|hour|hourly|daily)[- ]?(?:tick|cadence|cycle|interval|loop)|every\s+\d+\s*(?:minutes?|hours?)/i);
  if (cadenceClaim) {
    const near = md.slice(Math.max(0, cadenceClaim.index - 260), cadenceClaim.index + 260);
    const sourced = FILE_LINE.test(near) || /\b(unknown|not stated|no cadence|per attempt|unstated)\b/i.test(near);
    add("M12", "any stated cadence is sourced or marked unknown",
      sourced ? `“${cadenceClaim[0]}” carries a source or an unknown marker` : `“${cadenceClaim[0]}” is stated with no file:line and no "unknown" nearby`, sourced);
  }

  // M9 — hedges in the actionable columns (advisory: the critic decides)
  const hedged = dataRows(b.tableRows).filter((l) => HEDGE.test(l));
  rows.push({
    id: "M9", what: "no hedged fixes in table rows",
    evidence: hedged.length ? `${hedged.length} rows hedge: ${hedged.slice(0, 2).map((l) => l.trim().slice(0, 60)).join(" · ")}` : "none",
    verdict: hedged.length ? "REVIEW" : "PASS",
  });

  // M10 — the caps must be named where the class has them. A verdict word on
  // its own does not show the caps were considered.
  if (spec.requireCaps) {
    const has = spec.requireCaps.test(md);
    add("M10", "the verdict's caps are named", has ? "found a cap statement" : "no mention of the caps", has);
  }

  // M11 — headline figures match a fresh collector run. Catches the stale
  // number: a review written from yesterday's collection.
  if (collector && spec.figures) {
    for (const [label, path] of Object.entries(spec.figures)) {
      const val = path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), collector);
      const forms = renderings(val);
      if (!forms.length) { rows.push({ id: "M11", what: `${label} present in collector`, evidence: `collector has no ${path}`, verdict: "NOT MEASURED" }); continue; }
      const found = forms.some((f) => md.includes(f));
      add("M11", `${label} matches the collector`, found ? `${val} appears as one of ${forms.slice(0, 3).join(" / ")}` : `collector says ${val} (${forms.slice(0, 3).join(" / ")}) — not found in the artifact`, found);
    }
  }

  const failed = rows.filter((r) => r.verdict === "FAIL").length;
  return { skill, rows, failed, prose, lead, verdict: failed ? "FAIL" : "PASS" };
}

function render(res) {
  const w = Math.max(...res.rows.map((r) => r.what.length));
  const lines = res.rows.map((r) => `  ${r.id}. ${r.what.padEnd(w)}  ${r.evidence.padEnd(52)} ${r.verdict}`);
  return `MECHANICAL: ${res.verdict} (${res.rows.length - res.failed}/${res.rows.length})\n${lines.join("\n")}`;
}

// --------------------------------------------------------------- self-test
function selfTest() {
  const dir = join(HERE, "fixtures");
  let failed = 0, total = 0;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".md")) continue;
    const [skill, want] = f.replace(/\.md$/, "").split("--");
    const res = barCheck(skill, readFileSync(join(dir, f), "utf8"));
    total++;
    if (res.verdict !== want.toUpperCase()) {
      failed++;
      console.log(`✗ ${f}: want ${want.toUpperCase()}, got ${res.verdict}\n${render(res)}`);
    } else {
      console.log(`✓ ${f} — ${res.verdict} (${res.rows.length - res.failed}/${res.rows.length})`);
    }
  }
  console.log(`\n${total - failed}/${total} fixtures graded as expected`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  function buildPack(skill, artifactPath, md, res, collector, target) {
  const spec = SPECS[skill];
  const bar = (() => {
    try { return readFileSync(join(HERE, "..", "skills", skill, "evals", "gauntlet", "BAR.md"), "utf8"); }
    catch { return "(bar not found)"; }
  })();
  // Only the collector fields the bar actually cross-checks — not the whole
  // JSON, which is a third of a critic's context for facts it will not use.
  const figures = {};
  if (collector && spec.figures) {
    for (const [label, path] of Object.entries(spec.figures)) {
      figures[label] = path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), collector);
    }
  }
  // The cited lines, pulled once, so nobody opens files to check them.
  const cited = [];
  if (target) {
    for (const m of md.matchAll(/`?([\w./-]+\.(?:md|mjs|js|ts|tsx|py|sh|ps1|ya?ml|json|toml|astro|css|html)):(\d+)`?/g)) {
      const [, file, lineNo] = m;
      try {
        const lines = readFileSync(join(target, file), "utf8").split("\n");
        const i = Number(lineNo) - 1;
        if (lines[i] != null) cited.push(`${file}:${lineNo}  ${lines[i].trim().slice(0, 160)}`);
      } catch { /* M13 already reported it */ }
    }
  }
  return `# Evidence pack — ${skill}

Everything needed to grade this artifact. You should not need to open the repo
or re-run a collector; if you do, say which fact was missing and why.

## The artifact

${md}

---

## The bar

${bar}

---

## Mechanical results (already settled — do not re-check)

\`\`\`
${render(res)}
\`\`\`

## Collector figures the bar cross-checks

${Object.entries(figures).map(([k, v]) => `- **${k}**: ${JSON.stringify(v)}`).join("\n") || "(no collector supplied)"}

## Cited lines, pulled from the target

${cited.length ? cited.map((c) => "- `" + c + "`").join("\n") : "(none with line numbers, or no target supplied)"}

---

## Your job

Grade only what the mechanical results above do **not** settle: the judgement
criteria in the bar's class section, the truth of the claims, and whether the
evidence supports the verdict. Return the shape the critic prompt specifies.
`;
}

const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const [skill, path] = args;
    if (!skill || !path) { console.error("usage: bar-check.mjs <skill> <artifact.md> [--collector run.json]"); process.exit(2); }
    const ci = args.indexOf("--collector");
    const collector = ci >= 0 && args[ci + 1] ? JSON.parse(readFileSync(args[ci + 1], "utf8")) : null;
    const ti = args.indexOf("--target");
    const target = ti >= 0 ? args[ti + 1] : null;
    const md = readFileSync(path, "utf8");
    const res = barCheck(skill, md, collector, target);
    const pi = args.indexOf("--pack");
    if (pi >= 0 && args[pi + 1]) {
      const out = buildPack(skill, path, md, res, collector, target);
      writeFileSync(args[pi + 1], out);
      console.log(`${render(res)}\n\npack → ${args[pi + 1]}  (${Math.round(out.length / 4000)}k tokens; a critic reads this in one turn)`);
      process.exit(res.verdict === "PASS" ? 0 : 1);
    }
    console.log(render(res));
    process.exit(res.verdict === "PASS" ? 0 : 1);
  }
}
