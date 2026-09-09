#!/usr/bin/env node
// Capture the README showcase images from docs/showcase/pages/*.html.
//
//   node scripts/showcase.mjs                 # shoot every page
//   node scripts/showcase.mjs loop-atlas      # shoot one
//   node scripts/showcase.mjs --gif loop-atlas      # animated GIF of .flow (needs ImageMagick)
//
// Pages are captured from file:// — no login, no publishing, deterministic.
// Full page, 2× device pixel ratio, animations frozen on their final frame
// (the pages honour prefers-reduced-motion, which is what a still should show).
//
// --gif steps the page's own CSS animations frame by frame through the Web
// Animations API rather than screenshotting in real time, so the GIF is
// reproducible and its timing is exactly the page's.
//
// Playwright is not a dependency of this repo. Resolve it from a local
// install, or from the npx cache after `npx -y playwright@1.55.0 --help`.

import { readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PAGES = join(ROOT, "docs", "showcase", "pages");
const OUT = join(ROOT, "docs", "showcase");

const VIEWPORT = { width: 1180, height: 1000 };
const GIF_SELECTOR = ".flow";   // the element --gif records
const SCALE = 2;

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const roots = [ROOT, join(homedir(), "node_modules")];
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    for (const d of readdirSync(npx)) {
      const p = join(npx, d, "node_modules");
      if (existsSync(join(p, "playwright"))) roots.push(p);
    }
  }
  for (const r of roots) {
    try { return req(join(r, "playwright")); } catch { /* next */ }
  }
  try { return req("playwright"); } catch { /* fall through */ }
  console.error(
    "playwright not found. Either:\n" +
    "  npm i -D playwright && npx playwright install chromium\n" +
    "or prime the npx cache once:\n" +
    "  npx -y playwright@1.55.0 --help");
  process.exit(1);
}

const pageFiles = () =>
  readdirSync(PAGES).filter((f) => f.endsWith(".html")).map((f) => basename(f, ".html")).sort();

async function shoot(browser, name, { frames = 0 } = {}) {
  const file = join(PAGES, `${name}.html`);
  if (!existsSync(file)) { console.error(`✗ no such page: ${name}`); return false; }

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: frames ? 1 : SCALE,
    colorScheme: "light",
    // A still of an animated page should be its final, complete frame — the
    // pages are authored so reduced-motion lands exactly there.
    reducedMotion: frames ? "no-preference" : "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);

  if (frames) {
    const dir = join(tmpdir(), `showcase-${name}-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const target = await page.$(GIF_SELECTOR);
    if (!target) { console.error(`✗ ${name}: no ${GIF_SELECTOR} to record`); await ctx.close(); return false; }

    // Freeze the page's own animations and step them: reproducible timing.
    const duration = await page.evaluate(() => {
      const anims = document.getAnimations();
      anims.forEach((a) => a.pause());
      return Math.max(0, ...anims.map((a) => {
        const t = a.effect?.getComputedTiming?.() ?? {};
        return (t.delay ?? 0) + (t.activeDuration ?? 0);
      }));
    });
    const step = duration / frames;
    const shots = [];
    for (let i = 0; i <= frames; i++) {
      await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), i * step);
      const shot = join(dir, `${String(i).padStart(3, "0")}.png`);
      await target.screenshot({ path: shot });
      shots.push(shot);
    }
    // Hold on the finished picture, then let the loop breathe before repeating.
    const out = join(OUT, `${name}.gif`);
    execFileSync("magick", [
      "-loop", "0", "-delay", String(Math.round(step / 10)), ...shots,
      "-delay", "220", shots[shots.length - 1],          // hold on the finished picture
      "-layers", "OptimizeTransparency", "-fuzz", "2%", out,
    ]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`✓ ${name}.gif — ${frames + 1} frames · ${(duration / 1000).toFixed(1)}s of page time`);
  } else {
    const out = join(OUT, `${name}.png`);
    await page.screenshot({ path: out, fullPage: true });
    const { width, height } = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    console.log(`✓ ${name}.png — ${width * SCALE}×${height * SCALE}`);
  }
  await ctx.close();
  if (errors.length) console.error(`  ! page errors: ${errors.slice(0, 3).join(" | ")}`);
  return true;
}

const args = process.argv.slice(2);
const frames = args.includes("--gif") ? Number(args[args.indexOf("--gif") + 1] ?? 0) || 44 : 0;
const names = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const targets = names.length ? names : pageFiles();

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let ok = true;
for (const n of targets) ok = (await shoot(browser, n, { frames })) && ok;
await browser.close();
process.exit(ok ? 0 : 1);
