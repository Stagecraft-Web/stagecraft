/**
 * Migration content mapper — v1
 *
 * Maps extracted site content into the Stagecraft template content schema.
 * Targets the musician-site template layout:
 *   src/content/config/site.json
 *   src/content/config/nav.json
 *   src/content/config/theme.json
 *   src/content/pages/home.md
 *   src/content/pages/about.md
 *   src/content/pages/music.md
 *   src/content/pages/press.md
 *   src/content/pages/contact.md
 */

import type { ExtractedSite, ExtractedPage } from "./crawler";
import { buildMarkdownBody, buildFrontmatter, buildMarkdownPage } from "../content-utils";

export { buildMarkdownBody, buildFrontmatter, buildMarkdownPage };

export interface MappedFile {
  path: string;
  content: string;
  /** 0.0–1.0 confidence that this content is accurate and complete */
  confidence: number;
  /** Source URL the content was drawn from, empty if synthesised */
  sourceUrl: string;
}

export interface MappedContent {
  files: MappedFile[];
  /** Detected social links mapped to site.json socialLinks format */
  detectedSocialLinks: Record<string, string>;
}

// ─── Page role detection ──────────────────────────────────────────────────────

type PageRole = "home" | "about" | "music" | "press" | "contact" | "tour" | "other";

const ROLE_KEYWORDS: Record<PageRole, string[]> = {
  home: ["home", "index", "main", "start", "welcome"],
  about: ["about", "bio", "biography", "story", "who", "artist", "band"],
  music: ["music", "album", "releases", "discography", "listen", "songs", "tracks", "singles"],
  press: ["press", "media", "news", "epk", "publicity", "quotes", "reviews", "coverage"],
  contact: ["contact", "booking", "hire", "reach", "email", "message", "get in touch"],
  tour: ["tour", "shows", "dates", "live", "events", "schedule", "tickets", "gigs"],
  other: [],
};

export function detectPageRole(page: ExtractedPage): PageRole {
  const urlLower = page.url.toLowerCase();
  const titleLower = page.title.toLowerCase();
  const headingsLower = page.headings.map((h) => h.toLowerCase()).join(" ");
  const combined = `${urlLower} ${titleLower} ${headingsLower}`;

  for (const role of ["contact", "press", "music", "about", "tour"] as PageRole[]) {
    if (ROLE_KEYWORDS[role].some((kw) => combined.includes(kw))) return role;
  }

  // Default: if it looks like the root or index path, call it home
  try {
    const pathname = new URL(page.url).pathname;
    if (pathname === "/" || pathname === "" || pathname === "/index.html") return "home";
  } catch {
    // ignore
  }

  return "home";
}

/** Choose the best page for a role from a list of candidates. */
function pickBestPage(pages: ExtractedPage[], role: PageRole): ExtractedPage | null {
  const scored = pages.map((p) => ({ page: p, score: scorePageForRole(p, role) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].page : null;
}

function scorePageForRole(page: ExtractedPage, role: PageRole): number {
  const keywords = ROLE_KEYWORDS[role];
  if (!keywords.length) return 0;
  const combined = `${page.url} ${page.title} ${page.headings.join(" ")}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (combined.includes(kw)) score++;
  }
  return score;
}

// ─── site.json builder ────────────────────────────────────────────────────────

interface SiteConfig {
  artistName: string;
  siteTitle: string;
  siteDescription: string;
  email: string;
  copyright: string;
  socialLinks: Record<string, string>;
}

export function buildSiteConfig(
  extracted: ExtractedSite,
  artistName: string
): SiteConfig {
  const email =
    extracted.socialLinks.find((l) => l.href.startsWith("mailto:"))?.href.replace("mailto:", "") ?? "";

  const socialLinks: Record<string, string> = {};
  for (const link of extracted.socialLinks) {
    if (link.href.startsWith("mailto:")) continue;
    socialLinks[link.text.toLowerCase()] = link.href;
  }

  return {
    artistName,
    siteTitle: `${artistName} — Official Website`,
    siteDescription: extracted.pages[0]?.description || `Official website of ${artistName}.`,
    email,
    copyright: `© ${new Date().getFullYear()} ${artistName}. All rights reserved.`,
    socialLinks,
  };
}

// ─── nav.json builder ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
}

const ROLE_TO_NAV_HREF: Record<string, string> = {
  home: "/",
  about: "/about",
  music: "/music",
  press: "/press",
  contact: "/contact",
  tour: "/tour",
};

const ROLE_TO_NAV_LABEL: Record<string, string> = {
  home: "Home",
  about: "About",
  music: "Music",
  press: "Press",
  contact: "Contact",
  tour: "Tour",
};

export function buildNav(pages: ExtractedPage[]): NavItem[] {
  const seen = new Set<string>();
  const nav: NavItem[] = [];

  for (const page of pages) {
    const role = detectPageRole(page);
    if (role === "other") continue;
    const href = ROLE_TO_NAV_HREF[role];
    if (!href || seen.has(href)) continue;
    seen.add(href);
    nav.push({ label: ROLE_TO_NAV_LABEL[role], href });
  }

  // Ensure Home is always first
  const homeIdx = nav.findIndex((n) => n.href === "/");
  if (homeIdx > 0) {
    const [home] = nav.splice(homeIdx, 1);
    nav.unshift(home);
  }
  if (nav.length === 0 || nav[0].href !== "/") {
    nav.unshift({ label: "Home", href: "/" });
  }

  return nav;
}

// ─── Main map function ────────────────────────────────────────────────────────

/**
 * Map an `ExtractedSite` into template content files.
 * Returns a `MappedContent` with all files ready to overlay on the template.
 */
export function mapExtractedContent(
  extracted: ExtractedSite,
  artistName: string
): MappedContent {
  const files: MappedFile[] = [];
  const { pages } = extracted;

  // site.json
  const siteConfig = buildSiteConfig(extracted, artistName);
  files.push({
    path: "src/content/config/site.json",
    content: JSON.stringify(siteConfig, null, 2) + "\n",
    confidence: 0.85,
    sourceUrl: extracted.rootUrl,
  });

  // nav.json
  const nav = buildNav(pages);
  files.push({
    path: "src/content/config/nav.json",
    content: JSON.stringify({ items: nav }, null, 2) + "\n",
    confidence: 0.75,
    sourceUrl: extracted.rootUrl,
  });

  // Page content files
  const roles: PageRole[] = ["home", "about", "music", "press", "contact"];
  for (const role of roles) {
    const page = pickBestPage(pages, role);
    if (!page) continue;

    const mdPath = `src/content/pages/${role}.md`;
    const md = buildMarkdownPage(
      page.title || ROLE_TO_NAV_LABEL[role],
      page.description,
      page.headings,
      page.paragraphs
    );

    files.push({
      path: mdPath,
      content: md,
      confidence: page.paragraphs.length > 2 ? 0.8 : 0.5,
      sourceUrl: page.url,
    });
  }

  // Social links summary for report use
  const detectedSocialLinks: Record<string, string> = {};
  for (const link of extracted.socialLinks) {
    if (!link.href.startsWith("mailto:")) {
      detectedSocialLinks[link.text] = link.href;
    }
  }

  return { files, detectedSocialLinks };
}
