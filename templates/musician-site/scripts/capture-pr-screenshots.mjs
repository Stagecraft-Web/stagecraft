#!/usr/bin/env node
/**
 * capture-pr-screenshots.mjs
 *
 * Captures the standard set of PR screenshots for the musician-site
 * template. Boots a headless Chromium at 1440x900, visits the public
 * site + every page in the nav singleton, then visits the Keystatic
 * admin and captures each collection listing.
 *
 * Output goes to a local directory — PR screenshots are then uploaded
 * to a public gist and referenced from the PR body (this repo is
 * private, so in-tree raw URLs 404 for anonymous viewers). See
 * `docs/screenshots/README.md` for the full upload workflow.
 *
 * Usage:
 *   node scripts/capture-pr-screenshots.mjs <dev-server-url> <output-dir>
 *     [--only site-home,admin-releases,...]
 *     [--jpeg-quality N]
 *     [--site-format jpeg|png]
 *
 * Examples:
 *   # Start the dev server separately, then:
 *   node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
 *        /tmp/pr-35-screenshots
 *
 *   # Only capture the press page + its admin view:
 *   node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
 *        /tmp/pr-35-screenshots --only site-press,admin-pages
 *
 * Output naming:
 *   site-<slug>.jpg    for each public page (home -> site-home.jpg)
 *   admin-home.png     for /keystatic
 *   admin-<name>.png   for each /keystatic/collection/<name>
 *
 * Viewport + Playwright setup mirrors the stagecraft crawler skill at
 * ~/.claude/skills/crawl-artist-site/crawler.mjs so the captures line
 * up with reference crawls.
 *
 * Keystatic admin note:
 *   Keystatic's local-storage mode is unauthenticated by default in
 *   dev — the /keystatic UI loads straight to the dashboard. If your
 *   setup requires GitHub OAuth (e.g. PUBLIC_KEYSTATIC_STORAGE=github),
 *   the admin captures will land on a "Sign in with GitHub" page.
 *   That's still useful as evidence the admin is reachable; for real
 *   admin screenshots in that case, capture them manually from a
 *   signed-in browser.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

// ---------- args ----------
const args = process.argv.slice(2);
if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
  console.error(
    "usage: capture-pr-screenshots.mjs <dev-server-url> <output-dir> " +
      "[--only <comma-list>] [--jpeg-quality N] [--site-format jpeg|png]"
  );
  process.exit(2);
}
const baseUrl = args[0].replace(/\/$/, "");
const outputDir = path.resolve(args[1]);

function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const onlyRaw = flagValue("--only");
const only = onlyRaw ? new Set(onlyRaw.split(",").map((s) => s.trim())) : null;
const jpegQuality = parseInt(flagValue("--jpeg-quality"), 10) || 80;
const siteFormat = (flagValue("--site-format") || "jpeg").toLowerCase();
if (!["jpeg", "png"].includes(siteFormat)) {
  console.error(`--site-format must be jpeg or png (got "${siteFormat}")`);
  process.exit(2);
}

// ---------- constants ----------
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 1500;
const KEYSTATIC_SETTLE_MS = 3000; // client-side render

// ---------- helpers ----------
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function shouldCapture(name) {
  if (!only) return true;
  return only.has(name);
}

function siteFilename(name) {
  const ext = siteFormat === "jpeg" ? "jpg" : "png";
  return `${name}.${ext}`;
}

async function capture(page, file, { isAdmin = false } = {}) {
  const opts = { path: file, fullPage: false };
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    opts.type = "jpeg";
    opts.quality = jpegQuality;
  }
  // Admin captures always PNG (text-heavy); overwrite if caller passed .png
  if (isAdmin) {
    opts.type = "png";
    delete opts.quality;
  }
  await page.screenshot(opts);
}

async function gotoAndSettle(page, url, settleMs = SETTLE_MS) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Let fonts + hero images settle. `networkidle` is flaky with long-lived
  // dev-server HMR sockets, so we just wait a fixed timeout.
  await page.waitForTimeout(settleMs);
  // Scroll to top in case a prior capture left us elsewhere.
  await page.evaluate(() => window.scrollTo(0, 0));
}

// ---------- nav discovery ----------
async function discoverSitePages(page) {
  await gotoAndSettle(page, `${baseUrl}/`);
  const navEntries = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('nav a[href], header a[href]')
    );
    const out = [];
    const seen = new Set();
    for (const a of anchors) {
      let url;
      try {
        url = new URL(a.href);
      } catch {
        continue;
      }
      if (url.origin !== location.origin) continue;
      const p = url.pathname.replace(/\/+$/, "") || "/";
      if (seen.has(p)) continue;
      seen.add(p);
      out.push({ path: p, label: (a.textContent || "").trim() });
    }
    return out;
  });

  // Always include home first, then the rest in nav order.
  const home = { path: "/", slug: "home", label: "Home" };
  const others = navEntries
    .filter((e) => e.path !== "/" && e.path !== "")
    .map((e) => ({
      path: e.path,
      slug: e.path.replace(/^\//, "").replace(/\//g, "-") || "home",
      label: e.label || e.path,
    }));
  return [home, ...others];
}

// ---------- keystatic discovery ----------
async function discoverKeystaticCollections(page) {
  await gotoAndSettle(page, `${baseUrl}/keystatic`, KEYSTATIC_SETTLE_MS);
  // Keystatic's left nav renders collection links as
  //   <a href="/keystatic/collection/<name>">…</a>
  const collections = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[href*="/keystatic/collection/"]')
    );
    const seen = new Set();
    const out = [];
    for (const a of anchors) {
      const m = a.getAttribute("href")?.match(/\/keystatic\/collection\/([^/?#]+)/);
      if (!m) continue;
      const name = decodeURIComponent(m[1]);
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  });
  return collections;
}

// ---------- main ----------
async function main() {
  await ensureDir(outputDir);
  console.log(`[capture] base=${baseUrl}`);
  console.log(`[capture] out=${outputDir}`);
  if (only) console.log(`[capture] only=${[...only].join(",")}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const manifest = { captured: [], skipped: [], errors: [] };

  // ---------- site ----------
  let sitePages = [];
  try {
    sitePages = await discoverSitePages(page);
  } catch (e) {
    console.error(`[capture] could not discover site nav: ${e.message}`);
    manifest.errors.push({ step: "discover-nav", message: e.message });
  }

  for (const p of sitePages) {
    const name = `site-${p.slug}`;
    if (!shouldCapture(name)) {
      manifest.skipped.push(name);
      continue;
    }
    const file = path.join(outputDir, siteFilename(name));
    try {
      await gotoAndSettle(page, `${baseUrl}${p.path}`);
      await capture(page, file);
      console.log(`[capture] ${name} -> ${path.basename(file)}`);
      manifest.captured.push({
        name,
        file: path.basename(file),
        url: `${baseUrl}${p.path}`,
      });
    } catch (e) {
      console.error(`[capture] FAIL ${name}: ${e.message}`);
      manifest.errors.push({ step: name, message: e.message });
    }
  }

  // ---------- keystatic admin ----------
  const adminHomeName = "admin-home";
  if (shouldCapture(adminHomeName)) {
    const file = path.join(outputDir, `${adminHomeName}.png`);
    try {
      await gotoAndSettle(page, `${baseUrl}/keystatic`, KEYSTATIC_SETTLE_MS);
      await capture(page, file, { isAdmin: true });
      console.log(`[capture] ${adminHomeName} -> ${path.basename(file)}`);
      manifest.captured.push({
        name: adminHomeName,
        file: path.basename(file),
        url: `${baseUrl}/keystatic`,
      });
    } catch (e) {
      console.error(`[capture] FAIL ${adminHomeName}: ${e.message}`);
      manifest.errors.push({ step: adminHomeName, message: e.message });
    }
  } else {
    manifest.skipped.push(adminHomeName);
  }

  let collections = [];
  try {
    collections = await discoverKeystaticCollections(page);
  } catch (e) {
    console.error(`[capture] could not discover keystatic collections: ${e.message}`);
    manifest.errors.push({ step: "discover-collections", message: e.message });
  }

  for (const name of collections) {
    const capName = `admin-${name}`;
    if (!shouldCapture(capName)) {
      manifest.skipped.push(capName);
      continue;
    }
    const file = path.join(outputDir, `${capName}.png`);
    try {
      await gotoAndSettle(
        page,
        `${baseUrl}/keystatic/collection/${encodeURIComponent(name)}`,
        KEYSTATIC_SETTLE_MS
      );
      await capture(page, file, { isAdmin: true });
      console.log(`[capture] ${capName} -> ${path.basename(file)}`);
      manifest.captured.push({
        name: capName,
        file: path.basename(file),
        url: `${baseUrl}/keystatic/collection/${name}`,
      });
    } catch (e) {
      console.error(`[capture] FAIL ${capName}: ${e.message}`);
      manifest.errors.push({ step: capName, message: e.message });
    }
  }

  await browser.close();

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  console.log(
    `[done] captured=${manifest.captured.length} skipped=${manifest.skipped.length} errors=${manifest.errors.length}`
  );
  if (manifest.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
