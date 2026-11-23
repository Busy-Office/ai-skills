#!/usr/bin/env node
// Builds the repeat-offender fixture for the correct gauntlet: a small repo whose history repeats
// one mistake twice, and the feedback memories a session in it would have. Synthetic throughout.
//
//   node build.mjs <out-dir>    → <out-dir>/repo (a git repo on main) and <out-dir>/memory/
//
// Same input, same commits: identity and dates are fixed, so the shas match on every machine.
// The answer key is README.md beside this file; the run under test does not read it.

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";

const out = process.argv[2];
if (!out) { console.error("usage: node build.mjs <out-dir>"); process.exit(2); }
const repo = join(out, "repo");
if (existsSync(repo)) { console.error(`${repo} already exists; give an empty directory`); process.exit(2); }
mkdirSync(repo, { recursive: true });

let day = 9;
const git = (...args) => {
  const when = `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`;
  const who = { NAME: "Sample Dev", EMAIL: "dev@example.invalid" };
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-c", "init.defaultBranch=main", ...args], {
    cwd: repo, stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, GIT_AUTHOR_NAME: who.NAME, GIT_AUTHOR_EMAIL: who.EMAIL, GIT_COMMITTER_NAME: who.NAME, GIT_COMMITTER_EMAIL: who.EMAIL, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
  });
};
const write = (base, files) => {
  for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(base, p)), { recursive: true }); writeFileSync(join(base, p), text); }
};
const commit = (message, files = {}, remove = []) => {
  day++;
  write(repo, files);
  for (const p of remove) rmSync(join(repo, p));
  git("add", "-A");
  git("commit", "-q", "-m", message);
};

git("init", "-q");

commit("initial: orders, report summary, db import check", {
  "package.json": `{
  "name": "sample-ledger",
  "private": true,
  "type": "module",
  "scripts": { "check": "node scripts/check-db-imports.mjs && node --test" }
}
`,
  "AGENTS.md": `# Working here

Gate: \`npm run check\` (the db import check, then the tests). CI runs the same command.

## Rules

| rule | enforced by |
|---|---|
| Only \`src/db/\` talks to the database; everything else calls \`src/db/orders.js\` | \`scripts/check-db-imports.mjs\` |
`,
  "src/db/client.js": `// The one connection. Only src/db/ may import this file.
const tables = {
  orders: [
    { id: 1, customer: "c1", cents: 1250 },
    { id: 2, customer: "c1", cents: 399 },
    { id: 3, customer: "c2", cents: 10000 },
  ],
};

export function query(table, where = () => true) {
  return (tables[table] ?? []).filter(where);
}
`,
  "src/db/orders.js": `import { query } from "./client.js";

export function orderTotal(customer) {
  return query("orders", (r) => r.customer === customer).reduce((sum, r) => sum + r.cents, 0);
}
`,
  "src/report/summary.js": `import { orderTotal } from "../db/orders.js";

export function summary(customer) {
  return \`\${customer}: \${(orderTotal(customer) / 100).toFixed(2)}\`;
}
`,
  "scripts/check-db-imports.mjs": `// Fails when code outside src/db/ imports the database client directly.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (p !== join("src", "db")) walk(p); continue; }
    if (p.endsWith(".js") && readFileSync(p, "utf8").includes('from "../db/client.js"')) offenders.push(p);
  }
};
walk("src");
if (offenders.length) {
  console.error(\`db client imported outside src/db/: \${offenders.join(", ")}\`);
  process.exit(1);
}
console.log("db imports ok");
`,
  "test/summary.test.js": `import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "../src/report/summary.js";

test("summary sums a customer's orders", () => {
  assert.equal(summary("c1"), "c1: 16.49");
});
`,
});

commit("report: CSV export of a customer's orders", {
  "src/report/export/csv.js": `import { query } from '../../db/client.js';

export function ordersCsv(customer) {
  return query("orders", (r) => r.customer === customer).map((r) => \`\${r.id},\${r.cents}\`).join("\\n");
}
`,
});

commit("fix(export): read orders through src/db/orders.js\n\nReview: report code must not import the db client.", {
  "src/db/orders.js": `import { query } from "./client.js";

export function orderTotal(customer) {
  return query("orders", (r) => r.customer === customer).reduce((sum, r) => sum + r.cents, 0);
}

export function ordersFor(customer) {
  return query("orders", (r) => r.customer === customer);
}
`,
  "src/report/export/csv.js": `import { ordersFor } from '../../db/orders.js';

export function ordersCsv(customer) {
  return ordersFor(customer).map((r) => \`\${r.id},\${r.cents}\`).join("\\n");
}
`,
});

commit("report: PDF summary line", {
  "src/report/pdf.js": `import { query } from '../db/client.js';

export function pdfLine(customer) {
  const cents = query("orders", (r) => r.customer === customer).reduce((sum, r) => sum + r.cents, 0);
  return \`\${customer} \${cents}\`;
}
`,
});

day++;
git("revert", "--no-edit", "HEAD");

commit("report: show the order date", {
  "src/report/dates.js": `export function shown(date) {
  return date.toLocaleDateString();
}
`,
});

commit("fix(dates): pin the locale so the report reads the same on every machine", {
  "src/report/dates.js": `export function shown(date) {
  return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
}
`,
});

write(join(out, "memory"), {
  "feedback-db-client.md": `---
name: report code goes through src/db/orders.js
description: correction given on the CSV export and again on the PDF summary
type: feedback
---
Report code reads orders through src/db/orders.js and never imports src/db/client.js. Said on the
CSV export and again on the PDF summary; the import check passed both times.
`,
  "feedback-replies.md": `---
name: short replies
description: how long a reply should be
type: feedback
---
Keep replies under ten lines; lead with the answer.
`,
  "project-roadmap.md": `---
name: roadmap
description: what is next for this project
type: project
---
Invoices after the reports settle.
`,
});

console.log(`built ${repo} (main, 7 commits) and ${join(out, "memory")}/ (3 memories)`);
