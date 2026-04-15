import { getCollection } from "astro:content";
import siteConfigRaw from "../content/config/site.json";
import navConfigRaw from "../content/config/nav.json";
import themeConfigRaw from "../content/config/theme.json";
import {
  siteConfigSchema,
  navConfigSchema,
  themeSchema,
  type SiteConfig,
  type NavConfigItem,
  type NavItem,
  type Theme,
} from "./schemas.js";

// Runtime-validated accessors for config singletons.
// These call Zod .parse() at runtime so invalid content throws immediately
// with a clear field-level error, not a silent type mismatch downstream.

export function getSiteConfig(): SiteConfig {
  return siteConfigSchema.parse(siteConfigRaw);
}

/** Raw nav config — parses nav.json and returns the ordered items. */
export function getNavConfig(): NavConfigItem[] {
  const config = navConfigSchema.parse(navConfigRaw);
  return config.items;
}

/**
 * Build the resolved navigation list from nav.json.
 *
 * The Navigation singleton (nav.json) is the single source of truth for which
 * pages appear in the nav and in what order. Items referencing pages that don't
 * exist are silently dropped (e.g. after a page is deleted).
 */
export async function buildNav(): Promise<NavItem[]> {
  const navConfig = getNavConfig();
  const allPages = await getCollection("pages");

  // Set of existing page slugs for fast lookup
  const existingPages = new Set(allPages.map((p) => p.id));

  return navConfig
    .filter((item) => existingPages.has(item.page))
    .map((item) => ({
      label: item.label,
      href: item.page === "home" ? "/" : `/${item.page}`,
    }));
}

export function getTheme(): Theme {
  return themeSchema.parse(themeConfigRaw);
}
