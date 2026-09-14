#!/usr/bin/env node
// graph-engineer lint: the shape of a Workflow script and its mechanical
// smells. Evidence only — the review adds the judgement.
//
// Usage: node graph-lint.mjs <workflow-script.js> [--json-only]
//        node graph-lint.mjs --self-test
//
// Read-only. Reads one file; runs nothing. Rows carry the G ids described in
// references/anti-patterns.md. A row is evidence, not a verdict: a false
// positive is disputed in the review, with the reason.

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------- masking --
// Replace string/template contents and comments with spaces of the same
// length, so structural regexes never match prose inside a prompt and line
// numbers survive. `${ … }` inside a template stays code.
export function mask(src) {
  const out = src.split("");
  let i = 0, n = src.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " "; };
  const tplStack = [];
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") j++; j++; }
      blank(i + 1, j); i = j + 1; continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "`") break;
        if (src[j] === "$" && src[j + 1] === "{") {
          // keep `${` as code, scan the expression, blank nothing inside it
          let depth = 1, k = j + 2;
          while (k < n && depth > 0) {
            if (src[k] === "{") depth++;
            else if (src[k] === "}") depth--;
            else if (src[k] === "'" || src[k] === '"' || src[k] === "`") {
              const q = src[k]; let m = k + 1;
              while (m < n && src[m] !== q) { if (src[m] === "\\") m++; m++; }
              for (let z = k + 1; z < m; z++) if (out[z] !== "\n") out[z] = " ";
              k = m;
            }
            k++;
          }
          j = k; continue;
        }
        if (out[j] !== "\n") out[j] = " ";
        j++;
      }
      i = j + 1; continue;
    }
    i++;
  }
  return out.join("");
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

// Find the index of the bracket that closes the one at `open`.
function matchBracket(code, open) {
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const close = pairs[code[open]];
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0) return c === close ? i : i; }
  }
  return -1;
}

// Every call `name(` in masked code that is a real call (not `.name(` unless
// allowed, not `xname(`). Returns [{idx, argStart, end}].
function calls(code, name, { allowMember = false } = {}) {
  const re = new RegExp(`(^|[^\\w$.])${name}\\s*\\(`, "g");
  const reMember = new RegExp(`(^|[^\\w$])${name}\\s*\\(`, "g");
  const r = allowMember ? reMember : re;
  const out = [];
  let m;
  while ((m = r.exec(code))) {
    const open = m.index + m[0].length - 1;
    const end = matchBracket(code, open);
    if (end < 0) continue;
    out.push({ idx: m.index + m[1].length, argStart: open + 1, end });
  }
  return out;
}

// First argument's string text (original source) for a call at argStart.
function firstStringArg(src, masked, argStart) {
  let i = argStart;
  while (i < src.length && /\s/.test(src[i])) i++;
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== "`") return null;
  let j = i + 1;
  while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
  return src.slice(i + 1, j);
}

// Top-level keys of an object literal in masked code between {a, b}.
function objectKeys(masked, a, b) {
  const keys = [];
  let depth = 0;
  for (let i = a + 1; i < b; i++) {
    const c = masked[i];
    if (c === "{" || c === "[" || c === "(") { depth++; continue; }
    if (c === "}" || c === "]" || c === ")") { depth--; continue; }
    if (depth === 0) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(masked.slice(i, i + 80));
      if (m && !/[\w$]/.test(masked[i - 1] || " ")) { keys.push(m[1]); i += m[0].length - 1; }
    }
  }
  return keys;
}

// ------------------------------------------------------------------- lint --
export function lint(src, file = "<stdin>") {
  const code = mask(src);
  const rows = [];
  const row = (id, severity, idx, what, fix) => rows.push({ id, severity, line: lineOf(src, idx), what, fix });

  // G1 meta
  const metaRe = /export\s+const\s+meta\s*=\s*\{/g;
  const metaM = metaRe.exec(code);
  const firstCode = code.search(/\S/);
  if (!metaM) row("G1", "error", 0, "no `export const meta = {…}`", "start the script with a pure-literal meta carrying name and description");
  else {
    if (metaM.index !== firstCode) row("G1", "error", metaM.index, "meta is not the first statement", "move `export const meta` above everything else");
    const open = metaM.index + metaM[0].length - 1;
    const close = matchBracket(code, open);
    const body = code.slice(open + 1, close);
    const stripped = body
      .replace(/[A-Za-z_$][\w$]*\s*:/g, " ")
      .replace(/\b(true|false|null)\b/g, " ")
      .replace(/-?\d+(\.\d+)?/g, " ");
    if (/[A-Za-z_$]|\(|\$\{|\.\.\./.test(stripped)) row("G1", "error", open, "meta contains a non-literal (identifier, call, spread or interpolation)", "meta must be a pure literal — no variables, calls, spreads or `${…}`");
    const orig = src.slice(open, close);
    if (!/\bname\s*:/.test(orig)) row("G1", "error", open, "meta has no `name`", "add `name`");
    if (!/\bdescription\s*:/.test(orig)) row("G1", "error", open, "meta has no `description`", "add a one-line `description`");
  }

  // G2 TypeScript
  for (const re of [
    /\binterface\s+[A-Za-z_$][\w$]*\s*\{/g,
    /\btype\s+[A-Z][\w$]*\s*=/g,
    /:\s*(string|number|boolean|any|unknown|void|never)(\[\])?\s*[,)=;]/g,
    /\bas\s+(const|string|number|any|unknown)\b/g,
    /\bimport\s+type\b/g,
  ]) { let m; while ((m = re.exec(code))) row("G2", "error", m.index, `TypeScript syntax: \`${m[0].trim()}\``, "scripts are plain JavaScript — remove annotations, interfaces, casts"); }

  // G3 forbidden calls
  for (const [re, what] of [
    [/\bDate\.now\s*\(/g, "Date.now()"],
    [/\bMath\.random\s*\(/g, "Math.random()"],
    [/\bnew\s+Date\s*\(\s*\)/g, "argless new Date()"],
  ]) { let m; while ((m = re.exec(code))) row("G3", "error", m.index, `${what} is unavailable in a workflow script (it would break resume)`, "pass timestamps in via args; vary prompts by index instead of randomness"); }

  // G4 node / filesystem
  for (const [re, what] of [
    [/^\s*import\s+(?!type\b)[^;]*?\bfrom\b/gm, "import statement"],
    [/\brequire\s*\(/g, "require()"],
    [/\bprocess\.[\w$]+/g, "process.*"],
    [/\bfs\.[\w$]+\s*\(/g, "fs.*()"],
  ]) { let m; while ((m = re.exec(code))) row("G4", "error", m.index, `${what} — no filesystem or Node API inside a workflow script`, "do the reading with an agent, or pass the data in via args"); }

  // Collect parallel/pipeline calls
  const par = calls(code, "parallel").map((c) => ({ ...c, kind: "parallel" }));
  const pipe = calls(code, "pipeline").map((c) => ({ ...c, kind: "pipeline" }));
  const fan = [...par, ...pipe].sort((a, b) => a.idx - b.idx);

  // G5 unfiltered results
  const assignedVars = [];
  for (const c of fan) {
    const before = code.slice(Math.max(0, c.idx - 80), c.idx);
    const asg = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s*$/.exec(before);
    const afterClose = code.slice(c.end + 1, c.end + 40);
    if (asg) {
      const v = asg[1];
      assignedVars.push({ v, call: c });
      const rest = code.slice(c.end + 1);
      const guarded = new RegExp(`\\b${v}\\s*\\.\\s*filter\\s*\\(`).test(rest) || /^\s*\)?\s*\.\s*filter\s*\(/.test(afterClose);
      const consumed = new RegExp(`\\b${v}\\s*\\.\\s*(flatMap|map|forEach|reduce|length|some|every|find)\\b|\\.\\.\\.${v}\\b|\\bof\\s+${v}\\b|\\b${v}\\s*\\[|JSON\\.stringify\\(\\s*${v}\\b`).exec(rest);
      if (consumed && !guarded) row("G5", "warn", c.end + 1 + consumed.index, `\`${v}\` (result of ${c.kind}() at line ${lineOf(src, c.idx)}) is consumed without .filter(Boolean)`, "a thunk/stage that throws resolves to null — filter before consuming, or the next stage sees a hole");
    } else {
      const inline = /^\s*\)?\s*\.\s*filter\s*\(/.test(afterClose);
      const returned = /\breturn\s+(await\s+)?$/.test(before);
      if (returned && !inline) row("G5", "warn", c.idx, `${c.kind}() result is returned unfiltered`, "nulls from failed thunks reach the caller — .filter(Boolean) first");
    }
  }

  // G6 barrier smell: parallel → per-item transform(s) → parallel.
  // Follow the result variable through every per-item transform assigned from
  // it; if the next `await parallel(` consumes anything in that chain and no
  // statement between used the chain in a cross-item way, the first barrier
  // was not earned.
  const crossItem = /\bnew\s+(Set|Map)\b|\.sort\s*\(|\.reduce\s*\(|\.length\b|\.some\s*\(|\.every\s*\(|\.slice\s*\(|\.includes\s*\(|\.has\s*\(|\bdedupe|\buniq/;
  const parVars = assignedVars.filter((a) => a.call.kind === "parallel");
  for (const a of parVars) {
    const after = code.slice(a.call.end + 1);
    const nextPar = /\bawait\s+parallel\s*\(/.exec(after);
    if (!nextPar) continue;
    const chain = new Set([a.v]);
    const refsChain = (s) => [...chain].some((v) => new RegExp(`\\b${v}\\b`).test(s));
    let cross = false;
    for (const s of after.slice(0, nextPar.index).split(/\n|;/)) {
      if (!refsChain(s)) continue;
      const asg = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/.exec(s.trim());
      const expr = (asg ? asg[2] : s).replace(/\.filter\s*\(\s*Boolean\s*\)/g, "");
      if (crossItem.test(expr) || /\bawait\b/.test(expr)) { cross = true; break; }
      if (asg && /\.(filter|map|flatMap)\s*\(/.test(asg[2])) chain.add(asg[1]);
    }
    if (cross) continue;
    const argHead = after.slice(nextPar.index, nextPar.index + 400).replace(/\.filter\s*\(\s*Boolean\s*\)/g, "");
    if (refsChain(argHead)) {
      const hops = [...chain].slice(1);
      row("G6", "warn", a.call.end + 1 + nextPar.index, `parallel (\`${a.v}\`) → ${hops.length ? `per-item transform${hops.length > 1 ? "s" : ""} (\`${hops.join("` → `")}\`)` : "no transform"} → parallel, with no cross-item need in between`, "fold both stages and the transform into one pipeline(items, stageA, item => transform, stageB) — the first barrier waits on the slowest item for nothing");
    }
  }

  // G7 agent-as-plumbing, G10 worktree, G15 blanket model — per agent() call
  const agents = calls(code, "agent");
  let withModel = 0;
  for (const c of agents) {
    const prompt = firstStringArg(src, code, c.argStart);
    const opts = code.slice(c.argStart, c.end);
    if (/\bmodel\s*:/.test(opts)) withModel++;
    if (prompt) {
      const p = prompt.trim().toLowerCase();
      if (/^(please\s+)?(combine|merge|flatten|dedupe|deduplicate|de-duplicate|concatenate|concat|collect|aggregate|gather|join|compile)\b/.test(p))
        row("G7", "warn", c.idx, `agent() whose job is plumbing: "${prompt.trim().slice(0, 48)}…"`, "flatMap / Map-dedupe / filter in plain JS — zero tokens; keep agents for judgement");
      if (/\bisolation\s*:/.test(opts) && /worktree/.test(src.slice(c.argStart, c.end))) {
        const ro = /\b(review|audit|read|summari[sz]e|research|find|search|verify|judge|classify|analy[sz]e|inspect|list|count|grep|explain|refute|score|rank)\b/.test(p);
        const wr = /\b(write|edit|fix|implement|migrate|port|refactor|apply|modify|create|update|patch|rename|delete|commit|transform the file|rewrite)\b/.test(p);
        if (ro && !wr) row("G10", "warn", c.idx, "isolation: 'worktree' on an agent whose prompt reads as read-only", "worktrees cost setup + disk per agent and only prevent parallel file-write collisions — drop it unless this node writes files");
      }
    }
  }
  if (agents.length >= 3 && withModel === agents.length) row("G15", "info", agents[0].idx, `every one of ${agents.length} agent() calls overrides model`, "tier by judgement: leave the merge/adjudication nodes on the session model, drop only the bounded repetitive ones");

  // G8 / G9 loops
  const loopRe = /\b(while|for)\s*\(/g;
  let lm;
  const loops = [];
  while ((lm = loopRe.exec(code))) {
    const open = lm.index + lm[0].length - 1;
    const close = matchBracket(code, open);
    if (close < 0) continue;
    const cond = code.slice(open + 1, close);
    const bodyOpen = code.indexOf("{", close);
    if (bodyOpen < 0) continue;
    const bodyClose = matchBracket(code, bodyOpen);
    const body = code.slice(bodyOpen + 1, bodyClose);
    loops.push({ idx: lm.index, kind: lm[1], cond, body, bodyOpen, bodyClose });
  }
  for (const L of loops) {
    const condTrim = L.cond.trim();
    const hasBreak = /\bbreak\b/.test(L.body);
    const hasBudget = /\bbudget\.(remaining|spent)\s*\(/.test(L.cond + L.body);
    if (L.kind === "for" && /;.*;/.test(L.cond) && condTrim.replace(/;/g, "").trim() !== "") { /* classic for with a condition: bounded */ }
    else if (L.kind === "for" && /\b(of|in)\b/.test(L.cond)) { /* iteration over a finite collection */ }
    else {
      const trivial = condTrim === "" || /^(true|1)$/.test(condTrim);
      let changes = true;
      if (!trivial) {
        const ids = [...new Set((condTrim.match(/[A-Za-z_$][\w$]*/g) || []).filter((w) => !/^(true|false|null|Infinity|budget|length|size|total|remaining|spent|Boolean|Math)$/.test(w)))];
        changes = ids.some((v) => new RegExp(`\\b${v}\\s*(\\+\\+|--|[+\\-*/]?=)|\\b${v}\\s*\\.\\s*(push|add|delete|clear|splice|pop|shift)\\s*\\(|(\\+\\+|--)\\s*${v}\\b`).test(L.body));
      }
      if ((trivial || !changes) && !hasBreak && !hasBudget)
        row("G8", "warn", L.idx, `${L.kind} loop with no exit: ${trivial ? "condition is always true" : "nothing in the condition changes inside the body"} and no break/budget guard`, "give the cycle a dry counter (`while (dry < K)`), a budget guard (`budget.total && budget.remaining() > N`) or a cap — the 1000-agent backstop is not a design");
    }
    // G9 dedupe against confirmed
    const filters = [...L.body.matchAll(/\.filter\s*\(\s*(?:\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>|function)[^)]*?!\s*([A-Za-z_$][\w$]*)\s*\.\s*(some|includes|find|findIndex)\s*\(/g)];
    for (const f of filters) {
      const acc = f[1];
      const pushed = new RegExp(`\\b${acc}\\s*\\.\\s*push\\s*\\(`).test(L.body);
      const seenSet = /\bnew\s+Set\b/.test(code) && /\.has\s*\(/.test(L.body);
      if (pushed && !seenSet)
        row("G9", "warn", L.bodyOpen + f.index, `fresh items are deduped against \`${acc}\`, the array the loop pushes its accepted results into`, "dedupe against a Set of everything seen (accepted and rejected) — otherwise rejected findings return every round and the loop never runs dry");
    }
  }

  // G11 phase() inside a parallel/pipeline stage
  for (const c of fan) {
    const inner = code.slice(c.argStart, c.end);
    const pre = /(^|[^\w$.])phase\s*\(/g;
    let pm;
    while ((pm = pre.exec(inner))) row("G11", "warn", c.argStart + pm.index + pm[1].length, `phase() called inside a ${c.kind}() stage — the global phase races across items`, "use opts.phase on the agent() call instead: agent(p, { phase: 'Verify' })");
  }

  // G12 schema sanity
  const reqRe = /\brequired\s*:\s*\[/g;
  let rm;
  while ((rm = reqRe.exec(code))) {
    // enclosing object
    let depth = 0, o = rm.index;
    for (; o >= 0; o--) { const ch = code[o]; if (ch === "}" || ch === "]" || ch === ")") depth++; else if (ch === "{" || ch === "[" || ch === "(") { if (depth === 0) break; depth--; } }
    if (o < 0 || code[o] !== "{") continue;
    const oEnd = matchBracket(code, o);
    const propsM = /\bproperties\s*:\s*\{/.exec(code.slice(o, oEnd));
    const reqOpen = rm.index + rm[0].length - 1;
    const reqClose = matchBracket(code, reqOpen);
    const reqKeys = [...src.slice(reqOpen, reqClose).matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
    if (!propsM) { if (reqKeys.length) row("G12", "error", rm.index, "`required` with no `properties` in the same object", "required ⊆ properties, or the schema is unsatisfiable and agent() throws"); continue; }
    const pOpen = o + propsM.index + propsM[0].length - 1;
    const pClose = matchBracket(code, pOpen);
    const keys = new Set(objectKeys(code, pOpen, pClose).concat([...src.slice(pOpen, pClose).matchAll(/['"]([A-Za-z_$][\w$-]*)['"]\s*:/g)].map((x) => x[1])));
    for (const k of reqKeys) if (!keys.has(k)) row("G12", "error", rm.index, `required key \`${k}\` is not in properties`, "add it to properties or drop it from required — unsatisfiable schemas throw at agent()");
  }
  // root type of anything passed as schema:
  const schemaRe = /\bschema\s*:\s*([A-Za-z_$][\w$]*|\{)/g;
  let sm;
  const checkedNames = new Set();
  while ((sm = schemaRe.exec(code))) {
    let o;
    if (sm[1] === "{") o = sm.index + sm[0].length - 1;
    else {
      if (checkedNames.has(sm[1])) continue; checkedNames.add(sm[1]);
      const def = new RegExp(`(?:const|let|var)\\s+${sm[1]}\\s*=\\s*\\{`).exec(code);
      if (!def) continue;
      o = def.index + def[0].length - 1;
    }
    const oEnd = matchBracket(code, o);
    const top = objectKeys(code, o, oEnd);
    const typeM = /\btype\s*:\s*['"]([^'"]+)['"]/.exec(src.slice(o, oEnd));
    if (!top.includes("type") || (typeM && typeM[1] !== "object"))
      row("G12", "error", o, `schema root is ${typeM ? `type '${typeM[1]}'` : "missing `type`"} — must be type: 'object' with properties`, "wrap the value: { type: 'object', properties: { items: {…} }, required: ['items'] }");
  }

  // G13 no top-level return
  {
    let fnStack = [], depth = 0, topReturn = false;
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (c === "{") { depth++; const before = code.slice(Math.max(0, i - 40), i); if (/=>\s*$|\bfunction\b[^{]*$/.test(before)) fnStack.push(depth); }
      else if (c === "}") { if (fnStack.length && fnStack[fnStack.length - 1] === depth) fnStack.pop(); depth--; }
      else if (code.startsWith("return", i) && !/[\w$]/.test(code[i - 1] || " ") && !/[\w$]/.test(code[i + 6] || " ")) {
        // a `=> expr` arrow without braces: look back for `=>` on the same statement
        if (!fnStack.length) topReturn = true;
      }
    }
    if (!topReturn) row("G13", "warn", 0, "no top-level return — the workflow's result will be undefined", "return the synthesized object at the end so the caller (and the journal) gets a value");
  }

  // G14 silent caps
  const sliceRe = /\.slice\s*\(\s*(0\s*,\s*\d+|-\d+)\s*\)/g;
  let sc;
  while ((sc = sliceRe.exec(code))) {
    const window = code.slice(sc.index, sc.index + 900);
    if (!/(^|[^\w$.])log\s*\(/.test(window)) row("G14", "warn", sc.index, "work-list truncated with .slice(0, N) and nothing logged", "log() what was dropped — silent truncation reads as 'covered everything'");
  }

  // ------------------------------------------------------------- shape --
  const widthOf = (c) => {
    const arg = code.slice(c.argStart, c.end).trim();
    const orig = src.slice(c.argStart, c.end).trim();
    let m;
    if ((m = /^Array\.from\s*\(\s*\{\s*length\s*:\s*(\d+)/.exec(arg))) return Number(m[1]);
    if (arg.startsWith("[")) { const e = matchBracket(arg, 0); return countElements(arg.slice(0, e + 1)); }
    if ((m = /^([A-Za-z_$][\w$]*)\s*(\.filter\s*\(\s*Boolean\s*\))?\s*(\.map|\.flatMap|,|$)/.exec(arg))) {
      const def = new RegExp(`(?:const|let|var)\\s+${m[1]}\\s*=\\s*\\[`).exec(code);
      if (def) { const o = def.index + def[0].length - 1; const e = matchBracket(code, o); return countElements(code.slice(o, e + 1)); }
      if (/^args\b/.test(m[1])) return "args";
    }
    return null;
  };
  function countElements(lit) {
    let depth = 0, n = 0, any = false, trailing = false;
    for (let i = 1; i < lit.length - 1; i++) {
      const ch = lit[i];
      if (/\S/.test(ch)) { any = true; trailing = ch === ","; }
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) depth--;
      else if (ch === "," && depth === 0) n++;
    }
    return any ? n + (trailing ? 0 : 1) : 0;
  }

  const inRange = (i, c) => i > c.argStart && i < c.end;
  const topFan = fan.filter((c) => !fan.some((o) => o !== c && inRange(c.idx, o)));
  const loopBodies = loops.map((L) => ({ a: L.bodyOpen, b: L.bodyClose }));
  const inLoop = (i) => loopBodies.some((r) => i > r.a && i < r.b);
  const estimate = (rangeA, rangeB, mult) => {
    let total = 0; let unknown = false;
    const direct = agents.filter((a) => a.idx > rangeA && a.idx < rangeB && !fan.some((f) => inRange(a.idx, f) && f.argStart > rangeA && f.end < rangeB));
    total += direct.length * mult;
    for (const f of fan.filter((f) => f.argStart > rangeA && f.end < rangeB && !fan.some((o) => o !== f && inRange(f.idx, o) && o.argStart > rangeA && o.end < rangeB))) {
      // an array literal of thunks already lists each agent once — don't multiply
      const literal = code.slice(f.argStart, f.end).trim().startsWith("[");
      const w = widthOf(f);
      const wn = literal ? 1 : typeof w === "number" ? w : 1;
      if (!literal && typeof w !== "number") unknown = true;
      const r = estimate(f.argStart, f.end, mult * wn);
      total += r.total; unknown = unknown || r.unknown;
    }
    return { total, unknown };
  };
  const est = estimate(-1, code.length, 1);
  const shape = {
    agents: agents.length,
    parallel: par.length,
    pipeline: pipe.length,
    loops: loops.length,
    phases: [...new Set([...src.matchAll(/(^|[^\w$.])phase\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[2]))],
    fanOutWidths: topFan.map((c) => ({ kind: c.kind, line: lineOf(src, c.idx), width: widthOf(c) })),
    agentsInLoops: agents.filter((a) => inLoop(a.idx)).length,
    staticAgentEstimate: est.total,
    estimateNote: (est.unknown ? "some widths unresolved (counted as 1); " : "") + (!loops.length
      ? "no cycles"
      : agents.some((a) => inLoop(a.idx))
        ? "agents inside loops count once — multiply by expected rounds"
        : "loop present but its agent() calls sit outside the body (helper functions) — multiply the round's agents by expected rounds"),
    hasTopLevelReturn: !rows.some((r) => r.id === "G13"),
    meta: (() => { const m = /export\s+const\s+meta\s*=\s*\{([\s\S]*?)\n\}/.exec(src); if (!m) return null; const n = /name\s*:\s*['"]([^'"]+)/.exec(m[1]); return n ? n[1] : null; })(),
  };

  rows.sort((a, b) => a.line - b.line || a.id.localeCompare(b.id));
  const counts = { error: 0, warn: 0, info: 0 };
  for (const r of rows) counts[r.severity]++;
  return { file, shape, counts, rows };
}

// -------------------------------------------------------------- self-test --
const GOOD = `export const meta = {
  name: 'review-changes',
  description: 'Review changed files across dimensions, verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' } }, required: ['real'] }
const DIMENSIONS = [{ key: 'bugs', prompt: 'find bugs' }, { key: 'perf', prompt: 'find perf issues' }]
const results = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: 'review:' + d.key, phase: 'Review', schema: FINDINGS }),
  (review) => parallel(review.findings.map((f) => () =>
    agent('Try to refute: ' + f.title + '. Default to refuted if uncertain.', { phase: 'Verify', schema: VERDICT, effort: 'high' })
      .then((v) => ({ ...f, verdict: v })))),
)
const seen = new Set(); const confirmed = []; let dry = 0
while (dry < 2) {
  const found = (await parallel(Array.from({ length: 3 }, (_, i) => () => agent('Find bugs, angle ' + i, { schema: FINDINGS })))).filter(Boolean).flatMap((r) => r.findings)
  const fresh = found.filter((b) => !seen.has(b.title))
  if (!fresh.length) { dry++; continue }
  dry = 0; fresh.forEach((b) => seen.add(b.title))
  confirmed.push(...fresh)
}
const flat = results.filter(Boolean).flat()
return { flat, confirmed }
`;

const BAD = `export const meta = {
  name: 'smelly',
  description: 'planted smells',
}
const ITEMS = ['a', 'b', 'c', 'd']
const started = Date.now()
const raw = await parallel(ITEMS.slice(0, 2).map((i) => () => agent('Research ' + i, { schema: S, isolation: 'worktree', model: 'x' })))
const flat = raw.flatMap((r) => r.items)
const judged = await parallel(flat.map((f) => () => agent('Judge ' + f, { model: 'x' })))
const merged = await agent('Combine these results into one list: ' + JSON.stringify(judged), { model: 'x' })
const confirmed = []
while (true) {
  const found = (await parallel([() => agent('find', { model: 'x' })])).filter(Boolean)
  const fresh = found.filter((f) => !confirmed.some((c) => c.id === f.id))
  confirmed.push(...fresh)
}
await pipeline(ITEMS, (i) => { phase('Verify'); return agent('verify ' + i, { model: 'x' }) })
const S = { type: 'array', properties: { items: {} }, required: ['items', 'missing'] }
`;

function selfTest() {
  const good = lint(GOOD, "good.js");
  const bad = lint(BAD, "bad.js");
  const ids = (r) => [...new Set(r.rows.map((x) => x.id))].sort();
  const fails = [];
  if (good.rows.length) fails.push(`GOOD produced rows: ${JSON.stringify(good.rows)}`);
  if (good.shape.agents !== 3 || good.shape.pipeline !== 1 || good.shape.parallel !== 2 || good.shape.loops !== 1) fails.push(`GOOD shape off: ${JSON.stringify(good.shape)}`);
  const want = ["G3", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14", "G15"];
  const got = ids(bad);
  for (const w of want) if (!got.includes(w)) fails.push(`BAD missing ${w}`);
  for (const g of got) if (!want.includes(g)) fails.push(`BAD unexpected ${g}: ${JSON.stringify(bad.rows.filter((r) => r.id === g))}`);
  const l = (id) => bad.rows.find((r) => r.id === id)?.line;
  if (l("G3") !== 6) fails.push(`G3 line ${l("G3")} ≠ 6`);
  if (l("G7") !== 10) fails.push(`G7 line ${l("G7")} ≠ 10`);
  if (l("G8") !== 12) fails.push(`G8 line ${l("G8")} ≠ 12`);
  if (bad.shape.staticAgentEstimate < 8) fails.push(`BAD estimate ${bad.shape.staticAgentEstimate} < 8`);
  const lit = lint("export const meta = { name: 'l', description: 'd' }\nconst r = (await parallel([() => agent('a'), () => agent('b'), () => agent('c')])).filter(Boolean)\nreturn r\n", "lit.js");
  if (lit.shape.staticAgentEstimate !== 3) fails.push(`array-literal parallel of 3 agents estimated ${lit.shape.staticAgentEstimate}, want 3`);
  const helper = lint("export const meta = { name: 'h', description: 'd' }\nconst find = (i) => agent('find ' + i)\nlet dry = 0\nwhile (dry < 2) { const r = await find(dry); if (!r) dry++ }\nreturn dry\n", "helper.js");
  if (!/outside the body/.test(helper.shape.estimateNote)) fails.push(`helper-loop note: ${helper.shape.estimateNote}`);
  if (fails.length) { console.error("graph-lint self-test FAILED\n- " + fails.join("\n- ")); process.exit(1); }
  console.log(`graph-lint self-test ok — GOOD: 0 rows, shape ${JSON.stringify(good.shape.fanOutWidths)}; BAD: ${bad.rows.length} rows ${got.join(",")}`);
}

// ------------------------------------------------------------------- main --
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) { selfTest(); }
  else {
    const file = args.find((a) => !a.startsWith("--"));
    if (!file) { console.error("usage: graph-lint.mjs <workflow-script.js> [--json-only] | --self-test"); process.exit(2); }
    const src = readFileSync(file, "utf8");
    console.log(JSON.stringify(lint(src, file), null, 2));
  }
}
