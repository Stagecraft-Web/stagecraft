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
 * Build the resolved navigation list.
 *
 * Two controls work together:
 * - **Per-page `showInNav`** (inclusion) — each page decides whether it
 *   appears in the nav at all. Toggle this from the page editor in Keystatic.
 * - **Navigation singleton** (ordering) — the drag-to-reorder list in
 *   nav.json controls the order of visible pages. Entries for pages with
 *   `showInNav: false` are kept as dormant ordering hints so the page
 *   reappears in its previous position when re-enabled.
 *
 * Pages with `showInNav: true` that aren't listed in the Navigation singleton
 * are auto-appended at the end (e.g. newly created pages).
 */
export async function buildNav(): Promise<NavItem[]> {
  const navConfig = getNavConfig();
  const allPages = await getCollection("pages");

  // Map page slugs → page data for fast lookup
  const pageMap = new Map(allPages.map((p) => [p.id, p.data]));

  const result: NavItem[] = [];
  const seen = new Set<string>();

  // Phase 1: walk nav.json order, include only pages that exist and are visible
  for (const item of navConfig) {
    const page = pageMap.get(item.page);
    if (page && page.showInNav !== false) {
      result.push({
        label: item.label,
        href: item.page === "home" ? "/" : `/${item.page}`,
      });
    }
    // Mark as seen even if hidden, so we don't auto-append it below
    seen.add(item.page);
  }

  // Phase 2: auto-append visible pages not yet in nav.json
  for (const page of allPages) {
    if (!seen.has(page.id) && page.data.showInNav !== false) {
      result.push({
        label: page.data.title,
        href: page.id === "home" ? "/" : `/${page.id}`,
      });
    }
  }

  return result;
}

export function getTheme(): Theme {
  return themeSchema.parse(themeConfigRaw);
}
