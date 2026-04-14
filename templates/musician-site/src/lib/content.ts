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
 * Build the resolved navigation list by reconciling nav.json ordering with
 * page `showInNav` frontmatter fields.
 *
 * 1. Start with nav.json order (drag-to-reorder via Keystatic).
 * 2. Filter out items whose page doesn't exist or has `showInNav: false`.
 * 3. Auto-append any pages with `showInNav: true` that aren't in nav.json
 *    (newly created pages get added at the end automatically).
 */
export async function buildNav(): Promise<NavItem[]> {
  const navConfig = getNavConfig();
  const allPages = await getCollection("pages");

  // Map page slugs → page data for fast lookup
  const pageMap = new Map(allPages.map((p) => [p.id, p.data]));

  const result: NavItem[] = [];
  const seen = new Set<string>();

  // Phase 1: nav.json ordering — include only existing pages with showInNav
  for (const item of navConfig) {
    const page = pageMap.get(item.page);
    if (page && page.showInNav !== false) {
      result.push({
        label: item.label,
        href: item.page === "home" ? "/" : `/${item.page}`,
      });
      seen.add(item.page);
    }
  }

  // Phase 2: auto-append pages not in nav.json that have showInNav
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
