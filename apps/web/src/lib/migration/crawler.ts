/**
 * Migration crawler — v1
 *
 * Fetches and extracts structured content from simple brochure-style sites.
 * Crawls up to MAX_PAGES pages, following nav links on the same domain.
 *
 * HTML parsing and URL helpers live in @/lib/html-utils.
 * String utilities (stripHtml, inferArtistName) live in @stagecraft/shared.
 */

import { stripHtml, inferArtistName } from "@stagecraft/shared";
import {
  type ExtractedImage,
  type ExtractedEmbed,
  type ExtractedLink,
  extractTitle,
  extractDescription,
  extractHeadings,
  extractParagraphs,
  extractImages,
  extractEmbeds,
  extractNavLinks,
  extractSocialLinks,
  resolveUrl,
  isSameDomain,
} from "../html-utils";

export type { ExtractedImage, ExtractedEmbed, ExtractedLink };

const MAX_PAGES = 8;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Stagecraft-Migration-Crawler/1.0 (site migration tool; +https://stagecraft.dev)";

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

/** Return same-domain nav-link hrefs that haven't been visited yet. */
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
  const socialLinks =
    pages.length > 0
      ? extractSocialLinks(
          pages.map((p) => p.rawText).join(" ") +
            pages.map((p) => p.navLinks.map((l) => l.href).join(" ")).join(" "),
          rootUrl
        )
      : [];

  return {
    rootUrl,
    domain,
    siteTitle,
    pages,
    socialLinks,
    inferredName: inferArtistName(siteTitle),
  };
}
