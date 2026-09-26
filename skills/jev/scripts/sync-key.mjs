// SessionStart hook for the jev skill. Commands run through the Bash tool
// never see plugin config, so this hook — which does — copies the key the
// user entered at install (userConfig.api_key) into ~/.config/jev/secrets.env,
// where the jev command reads it.
//
// Silent when set up. One line of session context when there is no key at
// all. Never prints the key, never touches the network, always exits 0: a
// session must never fail to start because of this hook.

import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function configKey(env) {
  for (const [k, v] of Object.entries(env)) {
    if (k.toUpperCase() === "CLAUDE_PLUGIN_OPTION_API_KEY" && typeof v === "string") {
      const t = v.trim();
      // An unset option can arrive as an empty string or an unexpanded template.
      if (t && !t.includes("${")) return t;
    }
  }
  return null;
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
  const dir = env.JEV_CONFIG_DIR || join(env.HOME || homedir(), ".config", "jev");
  const file = join(dir, "secrets.env");
  const key = configKey(env);
  if (key) {
    const cur = fileKey(file);
    if (cur === null || sha(cur) !== sha(key)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, `JEV_AI_API_KEY=${key}\n`, { mode: 0o600 });
      chmodSync(tmp, 0o600);
      renameSync(tmp, file);
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

// Re-point ~/.local/bin/jev at this plugin version's launcher, but only if the
// user asked for the link (jev link) and it is still a link we made.
export function relink(env, launcher) {
  const dir = env.JEV_CONFIG_DIR || join(env.HOME || homedir(), ".config", "jev");
  if (!existsSync(join(dir, "linked"))) return "not_linked";
  const lp = join(env.HOME || homedir(), ".local", "bin", "jev");
  try {
    const st = lstatSync(lp);
    if (!st.isSymbolicLink()) return "not_a_link";
    if (readlinkSync(lp) === launcher) return "same";
    unlinkSync(lp);
  } catch {
    mkdirSync(dirname(lp), { recursive: true });
  }
  symlinkSync(launcher, lp);
  return "relinked";
}

const invoked = (() => { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch { return false; } })();
if (invoked) {
  try {
    sync(process.env);
    const root = process.env.CLAUDE_PLUGIN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    relink(process.env, join(root, "bin", "jev"));
  } catch {}
  process.exitCode = 0;
}
