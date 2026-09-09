#!/usr/bin/env node
// Drift check across collectors.
//
//   node evals/consistency.mjs
//
// The collectors are deliberately self-contained — the README tells you to
// symlink a single skill — so shared knowledge lives as copies, and copies
// drift. This asserts the copies still agree on the things that must not
// differ, and names every collector that would answer a question differently
// from its siblings.
//
// It exists because the record-file pattern was widened in one collector and
// left stale in three others within the hour, which is the exact defect
// loop-doctor was written to find in other people's projects.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, "..", "skills");

// Each rule: what every collector that has an opinion on this must know.
// A collector with no opinion (no matching source at all) is skipped — not
// every collector needs every concept.
const RULES = [
  {
    name: "excludes git worktree copies",
    // A repo with worktrees duplicates its whole tree; any count that includes
    // them is inflated several-fold. This has produced two wrong numbers.
    applies: (src) => /const IGNORE\s*=\s*new Set/.test(src),
    holds: (src) => /"worktrees"/.test(src),
    why: "a count that walks .claude/worktrees/ reports the tree several times over",
  },
  {
    name: "excludes node_modules",
    applies: (src) => /const IGNORE\s*=\s*new Set/.test(src),
    holds: (src) => /"node_modules"/.test(src),
    why: "vendored trees swamp any file count",
  },
  {
    name: "knows the append-only record files",
    // The loop's own bookkeeping is not code, not a queue, and not churn.
    // Two implementations are legitimate: a name list that must be kept
    // current, or discovery from what the governing docs actually name — which
    // needs no list at all. Only the first can drift, so only it is checked.
    applies: (src) => /\[\s*"record"\s*,\s*\/|RECORDS\s*=\s*\/|RECORD_FILE\s*=\s*\//.test(src),
    holds: (src) => {
      const discovers = /stateCandidates|matchAll\(\/\(\[\\w/.test(src);
      const listed = ["loop-log", "resume", "roundtable"].every((t) => src.toLowerCase().includes(t));
      return discovers || listed;
    },
    why: "a loop's log, resume file or .roundtable/ counted as code inflates churn and dilutes every per-commit rate",
  },
];

const collectors = [];
for (const skill of readdirSync(SKILLS).sort()) {
  const dir = join(SKILLS, skill, "scripts");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".mjs"))) {
    collectors.push({ skill, file: join(dir, f), name: `${skill}/${basename(f)}` });
  }
}

let failed = 0, checked = 0;
const rows = [];
for (const rule of RULES) {
  const relevant = collectors.filter((c) => rule.applies(readFileSync(c.file, "utf8")));
  if (!relevant.length) continue;
  const bad = relevant.filter((c) => !rule.holds(readFileSync(c.file, "utf8")));
  checked++;
  if (bad.length) failed++;
  rows.push({ rule, of: relevant.length, bad });
}

for (const { rule, of: n, bad } of rows) {
  if (!bad.length) {
    console.log(`✓ ${rule.name} — all ${n} collectors that care agree`);
  } else {
    console.log(`✗ ${rule.name} — ${bad.length} of ${n} drifted`);
    console.log(`    why it matters: ${rule.why}`);
    for (const c of bad) console.log(`    · ${c.name}`);
  }
}
console.log(`\n${checked - failed}/${checked} shared rules consistent across ${collectors.length} collectors`);
process.exit(failed ? 1 : 0);
