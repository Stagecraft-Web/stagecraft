import { getCollection } from "astro:content";
import siteConfigRaw from "../content/config/site.json";
import headerConfigRaw from "../content/config/header.json";
import themeConfigRaw from "../content/config/theme.json";
import appearanceConfigRaw from "../content/config/appearance.json";
import {
  siteConfigSchema,
  headerAndNavSchema,
  themeSchema,
  appearanceSchema,
  type SiteConfig,
  type HeaderAndNavConfig,
  type NavItem,
  type Theme,
  type Appearance,
} from "./schemas.js";

// Runtime-validated accessors for config singletons.
// These call Zod .parse() at runtime so invalid content throws immediately
// with a clear field-level error, not a silent type mismatch downstream.

export function getSiteConfig(): SiteConfig {
  return siteConfigSchema.parse(siteConfigRaw);
}

/**
 * Header & Navigation config — wordmark + header appearance + nav items.
 * The singleton owns nav membership/order and all header authoring lives
 * here so the editor surfaces them together.
 */
export function getHeaderAndNavConfig(): HeaderAndNavConfig {
  return headerAndNavSchema.parse(headerConfigRaw);
}

/**
 * Build the resolved navigation list from the Header & Navigation singleton.
 *
 * `items` is an ordered array of page slugs (managed via Keystatic's
 * relationship field). Each slug is resolved to a label (from the page's
 * title) and an href. Slugs that reference pages that no longer exist
 * are silently dropped.
 */
export async function buildNav(): Promise<NavItem[]> {
  const navSlugs = getHeaderAndNavConfig().items;
  const allPages = await getCollection("pages");
  const pageMap = new Map(allPages.map((p) => [p.id, p.data]));

  // When a page is marked as a splash, it displaces the home page from `/`
  // and home auto-moves to `/home`. Nav links to "home" must follow.
  const homeHref = await getHomeHref();

  return navSlugs
    .filter((slug) => pageMap.has(slug))
    .map((slug) => ({
      label: pageMap.get(slug)!.title,
      href: slug === "home" ? homeHref : `/${slug}`,
    }));
}

/**
 * Where the "home" page actually lives. When a splash page exists, it
 * displaces home from `/` → `/home`; otherwise home is at `/`. Shared by
 * `buildNav()` and `Header.astro` (logo link) so both stay in sync.
 */
export async function getHomeHref(): Promise<string> {
  const allPages = await getCollection("pages");
  const hasSplash = allPages.some((p) => p.data.isSplashPage);
  return hasSplash ? "/home" : "/";
}

export function getTheme(): Theme {
  return themeSchema.parse(themeConfigRaw);
}

export function getAppearance(): Appearance {
  return appearanceSchema.parse(appearanceConfigRaw);
}
