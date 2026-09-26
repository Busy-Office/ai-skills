// SessionStart hook for the jev skill. Commands run through the Bash tool
// never see plugin config, so this hook — which does — applies the three
// settings the user chose at install (or with /plugin configure busy-office):
//
//   api_key          copied to ~/.config/jev/secrets.env, where jev reads it
//   add_to_path      keeps ~/.local/bin/jev pointing at this plugin version,
//                    so plain `jev` works in a Terminal (default on)
//   allow_all_repos  keeps the "all" entry in ~/.config/jev/projects.json in
//                    step, the same as `jev allow --all` (default off)
//
// Silent when set up. One line of session context when there is no key at
// all. Never prints the key, never touches the network, never replaces a file
// or setting it didn't make, always exits 0: a session must never fail to
// start because of this hook.

import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const cfgDir = (env) => env.JEV_CONFIG_DIR || join(env.HOME || homedir(), ".config", "jev");

// Plugin options arrive as CLAUDE_PLUGIN_OPTION_<KEY>; the case of <KEY> is
// not pinned down, so match it either way. An unset option can arrive empty
// or as an unexpanded template.
export function option(env, name) {
  const want = `CLAUDE_PLUGIN_OPTION_${name}`.toUpperCase();
  for (const [k, v] of Object.entries(env)) {
    if (k.toUpperCase() === want && typeof v === "string") {
      const t = v.trim();
      if (t && !t.includes("${")) return t;
    }
  }
  return null;
}

export const configKey = (env) => option(env, "API_KEY");

export function flag(env, name, dflt) {
  const v = option(env, name);
  if (v === null) return dflt;
  return /^(true|1|yes|on)$/i.test(v);
}

function atomicWrite(file, text) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

function fileKey(f) {
  try {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?JEV_AI_API_KEY\s*=\s*["']?([^"'\s]*)["']?\s*$/.exec(line);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

export function sync(env, out = (s) => process.stdout.write(s)) {
  const dir = cfgDir(env);
  const file = join(dir, "secrets.env");
  const key = configKey(env);
  if (key) {
    const cur = fileKey(file);
    if (cur === null || sha(cur) !== sha(key)) {
      atomicWrite(file, `JEV_AI_API_KEY=${key}\n`);
      writeFileSync(join(dir, ".synced"), JSON.stringify({ ts: new Date().toISOString() }) + "\n", { mode: 0o600 });
      return "written";
    }
    return "same";
  }
  if (!existsSync(file)) {
    out("jev (busy-office plugin) isn't set up: to use it, run /plugin configure busy-office and enter a jev-ai.pro API key, then start a new session (or run `jev setup` in a Terminal window). Never paste the key into chat.\n");
    return "not_set_up";
  }
  return "file_only";
}

// ~/.config/jev/linked records who made ~/.local/bin/jev: "config" (this
// hook, from add_to_path) or anything else (the user, with `jev link`). The
// hook re-points either kind after an update, creates one only when
// add_to_path is on, and removes only the kind it made.
export function linkPath(env) { return join(env.HOME || homedir(), ".local", "bin", "jev"); }

export function syncLink(env, launcher) {
  const marker = join(cfgDir(env), "linked");
  const lp = linkPath(env);
  let by = null;
  try { by = readFileSync(marker, "utf8").trim() === "config" ? "config" : "user"; } catch {}
  let st = null;
  try { st = lstatSync(lp); } catch {}
  const want = flag(env, "ADD_TO_PATH", true);

  if (st && !st.isSymbolicLink()) return "not_a_link";          // someone else's file
  if (st && !by) return "foreign_link";                          // a link we didn't make
  if (!want && by === "config") {
    if (st) unlinkSync(lp);
    unlinkSync(marker);
    return "removed";
  }
  if (!want && !by) return "off";
  if (!st && by === "user" && !want) { unlinkSync(marker); return "off"; }
  if (st) {
    if (readlinkSync(lp) === launcher) return "same";
    unlinkSync(lp);
    symlinkSync(launcher, lp);
    return "relinked";
  }
  mkdirSync(dirname(lp), { recursive: true });
  symlinkSync(launcher, lp);
  if (!by) atomicWrite(marker, "config\n");
  return "linked";
}

// projects.json "all" entry: {"send": true, …, "by": "config"} when this hook
// made it. Turning the option off removes only an entry the hook made, so an
// allow-all the user set with `jev allow --all` is left alone.
export function syncAllowAll(env) {
  const f = join(cfgDir(env), "projects.json");
  const want = flag(env, "ALLOW_ALL_REPOS", false);
  let pol = { projects: {} };
  if (existsSync(f)) {
    try { pol = JSON.parse(readFileSync(f, "utf8")); } catch { return "policy_invalid"; }
    pol.projects ||= {};
  }
  const all = pol.all && typeof pol.all === "object" ? pol.all : null;
  if (want) {
    if (all?.send === true) return "same";
    pol.all = { ...(all || {}), send: true, by: "config" };
  } else {
    if (!all || all.by !== "config") return "same";
    delete pol.all;
  }
  atomicWrite(f, JSON.stringify(pol, null, 2) + "\n");
  return want ? "allowed_all" : "removed_all";
}

const invoked = (() => { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch { return false; } })();
if (invoked) {
  const root = process.env.CLAUDE_PLUGIN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  for (const step of [
    () => sync(process.env),
    () => syncLink(process.env, join(root, "bin", "jev")),
    () => syncAllowAll(process.env),
  ]) {
    try { step(); } catch {}
  }
  process.exitCode = 0;
}
