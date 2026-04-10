/**
 * Migration crawler — v1
 *
 * Fetches and extracts structured content from simple brochure-style sites.
 * Crawls up to MAX_PAGES pages, following nav links on the same domain.
 * Uses lightweight regex parsing — no external HTML parser dependency.
 */

const MAX_PAGES = 8;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Stagecraft-Migration-Crawler/1.0 (site migration tool; +https://stagecraft.dev)";

export interface ExtractedImage {
  src: string;
  alt: string;
}

export interface ExtractedEmbed {
  src: string;
  type: "youtube" | "soundcloud" | "spotify" | "bandcamp" | "vimeo" | "other";
}

export interface ExtractedLink {
  href: string;
  text: string;
}

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  paragraphs: string[];
  images: ExtractedImage[];
  embeds: ExtractedEmbed[];
  navLinks: ExtractedLink[];
  /** Page text with all HTML stripped, whitespace-normalised */
  rawText: string;
}

export interface ExtractedSite {
  rootUrl: string;
  domain: string;
  siteTitle: string;
  pages: ExtractedPage[];
  socialLinks: ExtractedLink[];
  /** Best-effort artist/brand name inferred from the site title */
  inferredName: string;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

/** Strip all HTML tags and decode common HTML entities. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract all matches for a regex as an array of match[index] strings. */
function matchAll(html: string, regex: RegExp, index = 1): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = r.exec(html)) !== null) {
    if (m[index]) results.push(m[index].trim());
  }
  return results;
}

/** Extract a single captured group, or "" if no match. */
function matchOne(html: string, regex: RegExp, index = 1): string {
  const m = regex.exec(html);
  return m?.[index]?.trim() ?? "";
}

// ─── Page content extractors ─────────────────────────────────────────────────

export function extractTitle(html: string): string {
  const og = matchOne(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return stripHtml(og);
  const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(title);
}

export function extractDescription(html: string): string {
  const og = matchOne(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (og) return stripHtml(og);
  const meta = matchOne(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return stripHtml(meta);
}

export function extractHeadings(html: string): string[] {
  const raw = matchAll(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  return raw.map(stripHtml).filter(Boolean).slice(0, 20);
}

export function extractParagraphs(html: string): string[] {
  const raw = matchAll(html, /<p[^>]*>([\s\S]*?)<\/p>/gi);
  return raw
    .map(stripHtml)
    .filter((p) => p.length > 30) // skip trivial/empty paragraphs
    .slice(0, 40);
}

export function extractImages(html: string, baseUrl: string): ExtractedImage[] {
  const results: ExtractedImage[] = [];
  const regex = /<img[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const tag = m[0];
    const src = matchOne(tag, /src=["']([^"']+)["']/i);
    const alt = matchOne(tag, /alt=["']([^"']*)["']/i);
    if (!src || src.startsWith("data:")) continue;
    const resolved = resolveUrl(src, baseUrl);
    if (resolved) {
      results.push({ src: resolved, alt: stripHtml(alt) });
    }
  }
  return results.slice(0, 30);
}

export function extractEmbeds(html: string): ExtractedEmbed[] {
  const results: ExtractedEmbed[] = [];
  const iframes = matchAll(html, /<iframe[^>]+src=["']([^"']+)["']/gi);
  for (const src of iframes) {
    results.push({ src, type: classifyEmbedSrc(src) });
  }
  // Also catch YouTube nocookie embeds and script-based embeds
  const scripts = matchAll(html, /(?:youtube\.com\/embed|youtu\.be)\/([A-Za-z0-9_-]{11})/gi);
  for (const id of scripts) {
    const src = `https://www.youtube.com/embed/${id}`;
    if (!results.some((e) => e.src.includes(id))) {
      results.push({ src, type: "youtube" });
    }
  }
  return results.slice(0, 20);
}

function classifyEmbedSrc(src: string): ExtractedEmbed["type"] {
  if (/youtube\.com|youtu\.be/i.test(src)) return "youtube";
  if (/soundcloud\.com/i.test(src)) return "soundcloud";
  if (/spotify\.com/i.test(src)) return "spotify";
  if (/bandcamp\.com/i.test(src)) return "bandcamp";
  if (/vimeo\.com/i.test(src)) return "vimeo";
  return "other";
}

export function extractNavLinks(html: string, baseUrl: string): ExtractedLink[] {
  // Try <nav> block first, fall back to header links
  const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i);
  const source = navMatch ? navMatch[0] : html;
  const anchors = matchAll(source, /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, 0);
  const links: ExtractedLink[] = [];
  for (const tag of anchors) {
    const href = matchOne(tag, /href=["']([^"']+)["']/i);
    const text = stripHtml(tag.replace(/href=["'][^"']+["']/, ""));
    if (!href || !text || text.length > 60) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (resolved) links.push({ href: resolved, text });
  }
  return links.slice(0, 12);
}

export function extractSocialLinks(html: string, baseUrl: string): ExtractedLink[] {
  const patterns = [
    { host: "instagram.com", label: "Instagram" },
    { host: "facebook.com", label: "Facebook" },
    { host: "twitter.com", label: "Twitter" },
    { host: "x.com", label: "Twitter" },
    { host: "youtube.com", label: "YouTube" },
    { host: "spotify.com", label: "Spotify" },
    { host: "soundcloud.com", label: "SoundCloud" },
    { host: "bandcamp.com", label: "Bandcamp" },
    { host: "tiktok.com", label: "TikTok" },
    { host: "linkedin.com", label: "LinkedIn" },
  ];
  const links: ExtractedLink[] = [];
  for (const { host, label } of patterns) {
    const regex = new RegExp(`href=["'](https?://(?:www\\.)?${host.replace(".", "\\.")}[^"']*)["']`, "i");
    const href = matchOne(html, regex);
    if (href) links.push({ href, text: label });
  }
  // Also pick up any mailto: links for contact emails
  const emails = matchAll(html, /href=["'](mailto:[^"']+)["']/gi);
  for (const href of emails.slice(0, 2)) {
    links.push({ href, text: "Email" });
  }
  return links;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

export function resolveUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isSameDomain(url: string, domain: string): boolean {
  try {
    return new URL(url).hostname === domain;
  } catch {
    return false;
  }
}

/** Return sameDomain nav-link hrefs that haven't been visited yet. */
function candidateUrls(navLinks: ExtractedLink[], domain: string, visited: Set<string>): string[] {
  return navLinks
    .map((l) => {
      try {
        const u = new URL(l.href);
        u.hash = "";
        u.search = "";
        return u.href;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u && isSameDomain(u, domain) && !visited.has(u));
}

/** Infer an artist/brand name from a site title string. */
export function inferArtistName(title: string): string {
  // Strip common suffixes like "— Official Site", "| Music", " - Home", etc.
  return title
    .replace(/[-–—|].*$/, "")
    .replace(/\s+(official|music|home|website|band|artist|musician|composer|singer|guitar|piano|drums)\s*$/i, "")
    .trim();
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Main crawl entry point ───────────────────────────────────────────────────

/**
 * Crawl a site starting from `rootUrl`.
 * Returns structured content for up to MAX_PAGES pages on the same domain.
 */
export async function crawlSite(rootUrl: string): Promise<ExtractedSite> {
  const rootParsed = new URL(rootUrl);
  const domain = rootParsed.hostname;

  const visited = new Set<string>();
  const queue: string[] = [rootUrl];
  const pages: ExtractedPage[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift()!;
    const normalized = (() => {
      try {
        const u = new URL(url);
        u.hash = "";
        return u.href;
      } catch {
        return url;
      }
    })();

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    const html = await fetchHtml(url);
    if (!html) continue;

    const page: ExtractedPage = {
      url,
      title: extractTitle(html),
      description: extractDescription(html),
      headings: extractHeadings(html),
      paragraphs: extractParagraphs(html),
      images: extractImages(html, url),
      embeds: extractEmbeds(html),
      navLinks: extractNavLinks(html, url),
      rawText: stripHtml(html).slice(0, 8000),
    };

    pages.push(page);

    // Enqueue unvisited same-domain nav links
    const candidates = candidateUrls(page.navLinks, domain, visited);
    for (const u of candidates) {
      if (!queue.includes(u)) queue.push(u);
    }
  }

  const siteTitle = pages[0]?.title ?? domain;
  const socialLinks = pages.length > 0 ? extractSocialLinks(pages.map((p) => p.rawText).join(" ") + pages.map((p) => p.navLinks.map((l) => l.href).join(" ")).join(" "), rootUrl) : [];

  return {
    rootUrl,
    domain,
    siteTitle,
    pages,
    socialLinks,
    inferredName: inferArtistName(siteTitle),
  };
}
