/**
 * HTML extraction utilities — generic, reusable across site-building flows.
 *
 * Provides lightweight HTML parsing without any external parser dependency.
 * Suitable for migration, edit-site, and other content-processing flows.
 */

import { stripHtml } from "@stagecraft/shared";

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

// ─── Internal regex helpers ───────────────────────────────────────────────────

function matchAll(html: string, regex: RegExp, index = 1): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = r.exec(html)) !== null) {
    if (m[index]) results.push(m[index].trim());
  }
  return results;
}

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
  // Try <nav> block first, fall back to full document
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

export function extractSocialLinks(html: string, _baseUrl: string): ExtractedLink[] {
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
