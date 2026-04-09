import siteConfigRaw from "../content/config/site.json";
import navConfigRaw from "../content/config/nav.json";
import themeConfigRaw from "../content/config/theme.json";
import {
  siteConfigSchema,
  navSchema,
  themeSchema,
  type SiteConfig,
  type NavItem,
  type Theme,
} from "./schemas.js";

// Runtime-validated accessors for config singletons.
// These call Zod .parse() at runtime so invalid content throws immediately
// with a clear field-level error, not a silent type mismatch downstream.

export function getSiteConfig(): SiteConfig {
  return siteConfigSchema.parse(siteConfigRaw);
}

export function getNav(): NavItem[] {
  return navSchema.parse(navConfigRaw);
}

export function getTheme(): Theme {
  return themeSchema.parse(themeConfigRaw);
}
