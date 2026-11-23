#!/usr/bin/env node
// automate-me: propose decision-log lines from one past session.
//
// Reads one Claude Code session transcript (.jsonl) and prints, one JSON line
// per question the user answered through AskUserQuestion, a proposed decision
// record (schema in ../references/decision-log.md). The user reviews the lines,
// fills in each `kind`, and appends the ones they keep to their log themselves.
// Question text and typed answers are copied verbatim, so review them before
// keeping them.
//
// Usage: node backfill.mjs <session.jsonl> [--kind <slug>]
//        node backfill.mjs --self-test
//
// Read-only: it reads the one file it is given and writes only to stdout (the
// lines) and stderr (a count). It never writes the decision log. Transcripts
// can pass 500 MB, so it streams them line by line.

import { createReadStream, realpathSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECOMMENDED = /\s*\(Recommended\)\s*$/i;
const strip = (label) => String(label).replace(RECOMMENDED, "").trim();

export async function backfill(path, { kind = null } = {}) {
  const asked = new Map();   // open questions: tool_use id → timestamp
  const lines = [];
  let declined = 0, malformed = 0;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    // Cheap filter before parsing: only the question and its answer matter.
    if (!line.includes("AskUserQuestion") && ![...asked.keys()].some((id) => line.includes(id))) continue;
    let r;
    try { r = JSON.parse(line); } catch { malformed++; continue; }
    for (const b of Array.isArray(r.message?.content) ? r.message.content : []) {
      if (b.type === "tool_use" && b.name === "AskUserQuestion") asked.set(b.id, r.timestamp ?? null);
      if (b.type !== "tool_result" || !asked.has(b.tool_use_id)) continue;
      const askedAt = asked.get(b.tool_use_id);
      asked.delete(b.tool_use_id);
      const result = r.toolUseResult;
      if (!result || typeof result !== "object" || !result.answers) { declined++; continue; }
      for (const q of result.questions ?? []) {
        const raw = result.answers[q.question];
        if (raw == null) { declined++; continue; }
        const options = (q.options ?? []).map((o) => o.label);
        const rec = options.find((l) => RECOMMENDED.test(l));
        const answer = strip(raw);
        const recommendation = rec ? strip(rec) : null;
        lines.push({
          ts: r.timestamp ?? askedAt, type: "decision", kind,
          question: q.question, options: options.map(strip),
          prediction_id: null,  // no prediction line exists for a past decision
          recommendation, confidence: null, evidence: null,
          mode: "asked", answer,
          // A multi-select answer or a typed "Other" cannot be matched to one option.
          outcome: !recommendation || q.multiSelect ? null : answer === recommendation ? "accepted" : "changed",
          source: { session: basename(path, ".jsonl"), header: q.header ?? null },
        });
      }
    }
  }
  return { lines, declined, malformed };
}

async function selfTest() {
  const got = await backfill(join(HERE, "..", "fixtures", "transcript.jsonl"));
  const by = (q) => got.lines.find((l) => l.question.startsWith(q));
  const checks = [
    ["one line per answered question, two from one call", got.lines.length === 4],
    ["(Recommended) found and stripped", by("Bump").recommendation === "Yes, bump" && !by("Bump").options.some((o) => /Recommended/.test(o))],
    ["answer equal to the recommendation → accepted", by("Bump").outcome === "accepted"],
    ["answer against the recommendation → changed", by("Rename").outcome === "changed" && by("Rename").answer === "Keep the name"],
    ["no recommended option → outcome null", by("Which colour").recommendation === null && by("Which colour").outcome === null],
    ["typed answer kept as written", by("Ship").answer === "Ship on Monday instead"],
    ["no prediction: prediction_id null, no inline prediction, mode asked", got.lines.every((l) => l.prediction_id === null && !("prediction" in l) && l.mode === "asked")],
    ["kind left for the user", got.lines.every((l) => l.kind === null)],
    ["declined question counted, not proposed", got.declined === 1],
    ["malformed line counted", got.malformed === 1],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} assertions passed`);
  process.exit(failed ? 1 : 0);
}

const isMain = process.argv[1] && (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) await selfTest();
  else {
    const i = args.indexOf("--kind");
    const kind = i >= 0 ? args[i + 1] ?? null : null;
    const path = args.find((a, j) => !a.startsWith("--") && args[j - 1] !== "--kind");
    if (!path) { console.error("usage: node backfill.mjs <session.jsonl> [--kind <slug>]"); process.exit(2); }
    const { lines, declined, malformed } = await backfill(path, { kind });
    for (const l of lines) process.stdout.write(JSON.stringify(l) + "\n");
    console.error(`${lines.length} proposed, ${declined} declined or unanswered, ${malformed} unreadable lines`);
  }
}
