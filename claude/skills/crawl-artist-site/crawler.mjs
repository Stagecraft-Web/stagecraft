#!/usr/bin/env node
/**
 * Stagecraft site crawler.
 *
 * Usage:
 *   node crawler.mjs <startUrl> <outputDir> [--max-pages N] [--no-interactions]
 *
 * Captures per discovered page:
 *   - viewport screenshots (scroll-NN.png) covering the full page
 *   - page.html — post-JS-render HTML
 *   - text.md   — slim plaintext outline
 *   - styles.json — typography + palette + CSS vars + dominant colors
 *   - interaction screenshots (lightbox, video) when applicable
 * Writes a manifest.json at the output root summarizing everything.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- args ----------
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: crawler.mjs <startUrl> <outputDir> [--max-pages N] [--no-interactions]");
  process.exit(2);
}
const startUrl = args[0];
const outputDir = path.resolve(args[1]);
const maxPages = parseInt(args[args.indexOf("--max-pages") + 1], 10) || 30;
const skipInteractions = args.includes("--no-interactions");

// ---------- constants ----------
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 2000;
const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 250;
const VIEWPORT_SCROLL_PX = 900;
const POLITENESS_MS = 800;

const SKIP_PATH_PATTERNS = [
  /\/feed\b/i,
  /\/search\b/i,
  /\/cart\b/i,
  /\/account\b/i,
  /\/login\b/i,
  /\.(pdf|zip|mp3|mp4|mov)$/i,
  // Image-asset URLs — direct-to-image pages (Squarespace `/s/*.jpg`, WordPress
  // `/wp-content/uploads/*`, generic image paths). Rendering an image in a
  // browser tab gives a useless "page" (1 giant <img>, no content), and if
  // harvested it bloats the manifest. Keep the URL in imageUrls (the harvester
  // captures <img src>) but don't crawl it as a page.
  /\.(jpe?g|png|gif|webp|svg|ico|bmp|tiff?)$/i,
  /\/s\/[^/]+\.(jpe?g|png|gif|webp)/i,
];
const PRIORITY_PATHS = [
  "/", "/about", "/about-1", "/bio", "/music", "/releases", "/discography",
  "/tour", "/shows", "/dates", "/photos", "/gallery", "/videos", "/watch",
  "/press", "/news", "/contact", "/store", "/shop", "/epk", "/projects", "/albums",
];
const EXTERNAL_SERVICE_HOSTS = {
  spotify: ["open.spotify.com", "spotify.com"],
  bandcamp: ["bandcamp.com"],
  soundcloud: ["soundcloud.com"],
  appleMusic: ["music.apple.com"],
  youtube: ["youtube.com", "youtu.be"],
  vimeo: ["vimeo.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
  twitter: ["twitter.com", "x.com"],
  tiktok: ["tiktok.com"],
  patreon: ["patreon.com"],
  ticketmaster: ["ticketmaster.com"],
  seetickets: ["seetickets.com"],
  eventbrite: ["eventbrite.com"],
  dice: ["dice.fm"],
  mailchimp: ["mailchimp.com"],
};

// ---------- helpers ----------
function slugifyPath(p) {
  // Root and `/home` must not collide. Some Squarespace sites use a splash
  // cover page at `/` and the real landing page at `/home` — if both slugify
  // to "home/", the second write overwrites the first and the splash screenshot
  // + "Enter site" button are lost. "root" is reserved for `/` so these stay
  // distinct on disk.
  if (p === "/" || p === "") return "root";
  const s = p.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, "--").replace(/[^a-z0-9-]/gi, "-");
  return s || "root";
}
function originOf(u) { try { return new URL(u).origin; } catch { return null; } }
function pathOf(u) { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return null; } }
function detectExternalService(host) {
  const lc = host.toLowerCase();
  for (const [name, hosts] of Object.entries(EXTERNAL_SERVICE_HOSTS)) {
    if (hosts.some(h => lc === h || lc.endsWith("." + h))) return name;
  }
  return null;
}
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

// ---------- in-page snippets ----------

const DISMISS_OVERLAYS = `(() => {
  const matchTextRe = /^(accept|agree|got it|ok|dismiss|close|no thanks|×|✕|x)$/i;
  let dismissed = 0;
  // Buttons by text
  for (const btn of document.querySelectorAll('button, a, [role="button"]')) {
    const t = (btn.textContent || '').trim();
    if (matchTextRe.test(t)) { try { btn.click(); dismissed++; } catch {} }
  }
  // Aria-labels
  for (const el of document.querySelectorAll('[aria-label*="close" i], [aria-label*="dismiss" i], [aria-label*="accept" i]')) {
    try { el.click(); dismissed++; } catch {}
  }
  // Common cookie-banner patterns
  for (const el of document.querySelectorAll('.cc-dismiss, [id*="cookie" i] button, [class*="cookie" i] button')) {
    try { el.click(); dismissed++; } catch {}
  }
  return dismissed;
})()`;

const COLLECT_LINKS_AND_MEDIA = `(() => {
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 80) }));
  const images = Array.from(document.querySelectorAll('img'))
    .map(el => ({ src: el.currentSrc || el.src || el.getAttribute('data-src') || null, alt: el.alt || null }))
    .filter(x => x.src);
  const videos = Array.from(document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]'))
    .map(el => ({ src: el.src || el.currentSrc || null, poster: el.poster || null }))
    .filter(x => x.src);
  const audio = Array.from(document.querySelectorAll('audio, iframe[src*="spotify"], iframe[src*="soundcloud"], iframe[src*="bandcamp"]'))
    .map(el => ({ src: el.src || el.currentSrc || null }))
    .filter(x => x.src);
  return { links, images, videos, audio };
})()`;

const STYLES_REPORT = `(() => {
  const pick = (sel) => document.querySelector(sel);
  const roles = {
    body:    document.body,
    h1:      pick('h1'),
    h2:      pick('h2'),
    h3:      pick('h3'),
    h4:      pick('h4'),
    p:       pick('main p, article p, section p') || pick('p'),
    a:       pick('main a, article a') || pick('a'),
    nav:     pick('nav a') || pick('header a'),
    button:  pick('button, a.button, .btn, [class*="button" i]'),
    caption: pick('figcaption, small'),
    quote:   pick('blockquote, q'),
  };
  const props = ['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','textTransform','color','backgroundColor'];
  const byRole = {};
  for (const [role, el] of Object.entries(roles)) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    byRole[role] = Object.fromEntries(props.map(p => [p, cs[p]]));
  }
  const allFonts = new Set();
  for (const el of Array.from(document.querySelectorAll('*')).slice(0, 800)) {
    allFonts.add(getComputedStyle(el).fontFamily);
  }
  const rootCs = getComputedStyle(document.documentElement);
  const cssVars = {};
  for (const prop of rootCs) {
    if (prop.startsWith('--')) cssVars[prop] = rootCs.getPropertyValue(prop).trim();
  }
  const palette = {
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyForeground: getComputedStyle(document.body).color,
    accent: roles.a ? getComputedStyle(roles.a).color : null,
    buttonBackground: roles.button ? getComputedStyle(roles.button).backgroundColor : null,
  };
  return { byRole, fontFamilies: [...allFonts], cssVars, palette, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio } };
})()`;

const TEXT_OUTLINE = `(() => {
  return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption'))
    .map(el => {
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text) return null;
      if (tag.startsWith('h')) return '#'.repeat(+tag[1]) + ' ' + text;
      if (tag === 'li') return '- ' + text;
      if (tag === 'blockquote') return '> ' + text;
      return text;
    })
    .filter(Boolean)
    .join('\\n\\n');
})()`;

const STRIP_SCRIPTS_HTML = `(() => {
  const clone = document.documentElement.cloneNode(true);
  for (const s of clone.querySelectorAll('script, noscript')) s.remove();
  return '<!doctype html>\\n' + clone.outerHTML;
})()`;

// ---------- crawler ----------
async function lazyLoadPass(page) {
  await page.evaluate(async ({ step, pause }) => {
    await new Promise((res) => {
      let y = 0;
      const max = document.documentElement.scrollHeight;
      const id = setInterval(() => {
        window.scrollTo(0, y);
        y += step;
        if (y > max) { clearInterval(id); window.scrollTo(0, 0); res(); }
      }, pause);
    });
  }, { step: SCROLL_STEP_PX, pause: SCROLL_PAUSE_MS });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function captureScrollScreenshots(page, pageDir, prefix = "scroll") {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = VIEWPORT.height;
  const slices = Math.max(1, Math.ceil(totalHeight / vh));
  const max = Math.min(slices, 8); // cap to keep things bounded
  const files = [];
  for (let i = 0; i < max; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(300);
    const fname = `${prefix}-${String(i + 1).padStart(2, "0")}.png`;
    const fpath = path.join(pageDir, fname);
    await page.screenshot({ path: fpath, fullPage: false });
    files.push(fname);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return files;
}

async function captureInteractions(page, pageDir) {
  const interactions = [];
  if (skipInteractions) return interactions;

  // Photo lightbox: click first <a> wrapping <img> in a grid-like container
  try {
    const candidate = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a > img, figure a img'));
      if (!anchors.length) return null;
      const a = anchors[0].closest('a');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      a.scrollIntoView({ block: 'center' });
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (candidate) {
      await page.waitForTimeout(400);
      await page.mouse.click(candidate.x, candidate.y);
      await page.waitForTimeout(800);
      const fname = "lightbox-01.png";
      await page.screenshot({ path: path.join(pageDir, fname), fullPage: false });
      interactions.push({ kind: "photo-lightbox", screenshots: [fname] });
      // Try to close
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  } catch (e) { /* swallow */ }

  // Video click: find a candidate play target
  try {
    const candidate = await page.evaluate(() => {
      const v = document.querySelector('video');
      const yt = document.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"]');
      const playBtn = document.querySelector('[class*="play" i]:not(audio)');
      const target = v || yt || playBtn;
      if (!target) return null;
      const r = target.getBoundingClientRect();
      target.scrollIntoView({ block: 'center' });
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, kind: yt ? 'iframe-embed' : v ? 'native-video' : 'play-button' };
    });
    if (candidate) {
      await page.waitForTimeout(400);
      // Don't actually navigate — for iframes, just screenshot the frame in place
      if (candidate.kind === 'native-video' || candidate.kind === 'iframe-embed') {
        const fname = "video-01.png";
        await page.screenshot({ path: path.join(pageDir, fname), fullPage: false });
        interactions.push({ kind: "video-present", embedKind: candidate.kind, screenshots: [fname] });
      } else {
        await page.mouse.click(candidate.x, candidate.y);
        await page.waitForTimeout(1000);
        const fname = "video-01.png";
        await page.screenshot({ path: path.join(pageDir, fname), fullPage: false });
        interactions.push({ kind: "video-play", embedKind: candidate.kind, screenshots: [fname] });
      }
      // Pause any media we triggered
      await page.evaluate(() => document.querySelectorAll('video, audio').forEach(m => { try { m.pause(); } catch {} }));
    }
  } catch (e) { /* swallow */ }

  return interactions;
}

async function crawlPage(page, urlPath, origin, pageDir) {
  const url = origin + urlPath;
  console.log(`[crawl] ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(SETTLE_MS);
  // Dismiss overlays — twice, in case banners reappear after JS settle
  await page.evaluate(DISMISS_OVERLAYS).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(DISMISS_OVERLAYS).catch(() => {});

  await ensureDir(pageDir);

  // Lazy load + scroll screenshots
  await lazyLoadPass(page);
  const screenshots = await captureScrollScreenshots(page, pageDir);

  // Harvest links/media/styles/text/html
  const harvest = await page.evaluate(COLLECT_LINKS_AND_MEDIA);
  const styles = await page.evaluate(STYLES_REPORT);
  const textMd = await page.evaluate(TEXT_OUTLINE);
  const html = await page.evaluate(STRIP_SCRIPTS_HTML);

  await fs.writeFile(path.join(pageDir, "page.html"), html);
  await fs.writeFile(path.join(pageDir, "text.md"), textMd);
  await fs.writeFile(path.join(pageDir, "styles.json"), JSON.stringify(styles, null, 2));

  // Categorize links
  const internalLinks = [];
  const externalLinks = [];
  const externalServices = {};
  for (const { href } of harvest.links) {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    let u;
    try { u = new URL(href); } catch { continue; }
    const cleanHref = u.origin + u.pathname.replace(/\/+$/, "") + u.search;
    if (u.origin === origin) {
      internalLinks.push(cleanHref);
    } else {
      externalLinks.push(cleanHref);
      const svc = detectExternalService(u.hostname);
      if (svc && !externalServices[svc]) externalServices[svc] = href;
    }
  }
  const dedupedInternal = [...new Set(internalLinks)];
  const dedupedExternal = [...new Set(externalLinks)];

  // Interactions
  const interactions = await captureInteractions(page, pageDir);

  return {
    path: urlPath,
    title: await page.title(),
    screenshots,
    html: "page.html",
    text: "text.md",
    styles: "styles.json",
    interactions,
    internalLinks: dedupedInternal,
    externalLinks: dedupedExternal,
    imageUrls: [...new Set(harvest.images.map(i => i.src).filter(Boolean))],
    videoUrls: [...new Set(harvest.videos.map(v => v.src).filter(Boolean))],
    audioUrls: [...new Set(harvest.audio.map(a => a.src).filter(Boolean))],
    notable: null,
    _externalServicesFound: externalServices,
  };
}

function dedupeAndPrioritize(candidates, origin, alreadyVisited) {
  const seen = new Set(alreadyVisited);
  const out = [];
  // Add priority paths first if they match origin
  const candidatePaths = new Set();
  for (const url of candidates) {
    if (originOf(url) !== origin) continue;
    if (SKIP_PATH_PATTERNS.some(rx => rx.test(url))) continue;
    const p = pathOf(url);
    if (!p) continue;
    candidatePaths.add(p);
  }
  for (const p of PRIORITY_PATHS) {
    if (candidatePaths.has(p) && !seen.has(p)) { out.push(p); seen.add(p); }
  }
  for (const p of candidatePaths) {
    if (!seen.has(p)) { out.push(p); seen.add(p); }
  }
  return out;
}

async function main() {
  let origin = originOf(startUrl);
  if (!origin) { console.error("invalid start URL"); process.exit(2); }
  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Probe the start URL once to resolve redirects (http→https, bare→www, etc.).
  // Without this, nav links harvested from the live DOM may be tagged external
  // because they use the post-redirect hostname while `origin` still holds the
  // pre-redirect one — producing a 1-page crawl with every internal link missed.
  //
  // The probe runs in a *throwaway* context. Running it in the main context
  // poisoned the session for Squarespace cover-page sites: the first visit to
  // `/` sets a "seen the splash" cookie, so the crawl-loop's subsequent visit
  // to `/` silently served the non-splash home content instead — masking the
  // splash page entirely. Isolating the probe keeps main-context cookies clean.
  {
    const probeContext = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });
    const probePage = await probeContext.newPage();
    try {
      await probePage.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      const effective = originOf(probePage.url());
      if (effective && effective !== origin) {
        console.log(`[crawl] redirect detected: ${origin} → ${effective} (using effective origin)`);
        origin = effective;
      }
    } catch (e) {
      console.error(`[crawl] initial probe failed: ${e.message}`);
    }
    await probeContext.close();
  }

  const visited = new Set();
  const queue = [pathOf(startUrl) || "/"];
  const pages = [];
  const allExternalServices = {};

  while (queue.length && pages.length < maxPages) {
    const urlPath = queue.shift();
    if (visited.has(urlPath)) continue;
    visited.add(urlPath);
    const pageSlug = slugifyPath(urlPath);
    const pageDir = path.join(outputDir, pageSlug);
    try {
      const entry = await crawlPage(page, urlPath, origin, pageDir);
      Object.assign(allExternalServices, entry._externalServicesFound);
      delete entry._externalServicesFound;
      pages.push(entry);
      // Discover more links to crawl
      const newPaths = dedupeAndPrioritize(entry.internalLinks, origin, visited);
      for (const p of newPaths) {
        if (!queue.includes(p) && !visited.has(p) && pages.length + queue.length < maxPages) queue.push(p);
      }
      await page.waitForTimeout(POLITENESS_MS);
    } catch (e) {
      console.error(`[crawl] error on ${urlPath}: ${e.message}`);
      pages.push({ path: urlPath, error: e.message });
    }
  }

  await browser.close();

  const manifest = {
    startUrl,
    domain: new URL(startUrl).hostname,
    crawledAt: new Date().toISOString(),
    viewport: VIEWPORT,
    pages,
    externalServices: allExternalServices,
  };
  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[done] ${pages.length} pages → ${outputDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
