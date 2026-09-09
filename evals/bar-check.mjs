#!/usr/bin/env node
// Mechanical pre-check for a gauntlet artifact.
//
//   node evals/bar-check.mjs <skill> <artifact.md>
//   node evals/bar-check.mjs --self-test
//
// It measures only what a machine can measure exactly — word counts, section
// presence, row shape, list length. Everything else is the critic's job, and
// the critic must not treat a green pre-check as a pass: an artifact can be
// perfectly shaped and still say nothing true.
//
// Run this BEFORE the critic. It makes the cheap failures cheap.

import { readFileSync, readdirSync, statSync } from "node:fs";
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
  },
  "requeue": {
    proseMax: 350, leadMax: 50, doNextMax: 5,
    opensWith: "table",
    sections: [/^#+\s*health of the queue/im, /^#+\s*proposed order/im, /^#+\s*hygiene/im],
    citedTables: [/duplicate|contradiction|ghost|stale/i],
    requireLanes: /\b(loop|subloop|gauntlet|human|blocked)\b/i,
  },
  "sharpen-intent": {
    proseMax: 350, leadMax: 50, doNextMax: 5,
    opensWith: "table",
    sections: [/^#+\s*where purpose is stated/im, /^#+\s*score/im, /^#+\s*the draft/im],
    citedTables: [],
    locatedSection: /does the work trace back/,
    requireVerdict: /\b(steering|usable|decorative|absent)\b/i,
  },
  "green-gate": {
    proseMax: 350, leadMax: 50, doNextMax: 4,
    opensWith: "table",
    sections: [/^#+\s*the gate/im, /^#+\s*what the ledger says/im, /^#+\s*why this will not become the bottleneck/im],
    citedTables: [],
    locatedSection: /the gate/,
  },
  "wake-weight": {
    proseMax: 300, leadMax: 40, doNextMax: 3,
    opensWith: "table",
    sections: [/^#+\s*what is loaded/im, /^#+\s*the cuts/im, /^#+\s*what not to cut/im],
    citedTables: [],
    locatedSection: /what is loaded/,
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

export function barCheck(skill, md) {
  const spec = SPECS[skill];
  if (!spec) throw new Error(`no spec for skill: ${skill}`);
  const b = blocks(md);
  const rows = [];
  const add = (id, what, evidence, pass) => rows.push({ id, what, evidence, verdict: pass ? "PASS" : "FAIL" });

  // M1 — prose budget
  const prose = words(b.prose);
  add("M1", `prose ≤ ${spec.proseMax} words`, `${prose} words outside tables, diagrams and code`, prose <= spec.proseMax);

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

  // M9 — hedges in the actionable columns (advisory: the critic decides)
  const hedged = dataRows(b.tableRows).filter((l) => HEDGE.test(l));
  rows.push({
    id: "M9", what: "no hedged fixes in table rows",
    evidence: hedged.length ? `${hedged.length} rows hedge: ${hedged.slice(0, 2).map((l) => l.trim().slice(0, 60)).join(" · ")}` : "none",
    verdict: hedged.length ? "REVIEW" : "PASS",
  });

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
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) selfTest();
  else {
    const [skill, path] = args;
    if (!skill || !path) { console.error("usage: bar-check.mjs <skill> <artifact.md>"); process.exit(2); }
    const res = barCheck(skill, readFileSync(path, "utf8"));
    console.log(render(res));
    process.exit(res.verdict === "PASS" ? 0 : 1);
  }
}
