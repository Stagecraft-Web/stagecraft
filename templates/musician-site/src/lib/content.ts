import { getCollection } from "astro:content";
import siteConfigRaw from "../content/config/site.json";
import navConfigRaw from "../content/config/nav.json";
import themeConfigRaw from "../content/config/theme.json";
import appearanceConfigRaw from "../content/config/appearance.json";
import {
  siteConfigSchema,
  navConfigSchema,
  themeSchema,
  appearanceSchema,
  type SiteConfig,
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

/** Raw nav config — parses nav.json and returns the ordered page slugs. */
export function getNavConfig(): string[] {
  const config = navConfigSchema.parse(navConfigRaw);
  return config.items;
}

/**
 * Build the resolved navigation list from the Navigation singleton.
 *
 * The singleton owns both membership and order — it's an ordered array of
 * page slugs (managed via Keystatic's relationship field). Each slug is
 * resolved to a label (from the page's title) and an href. Slugs that
 * reference pages that no longer exist are silently dropped.
 */
export async function buildNav(): Promise<NavItem[]> {
  const navSlugs = getNavConfig();
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
