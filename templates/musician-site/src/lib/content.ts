import siteConfig from "../content/config/site.json";
import navConfig from "../content/config/nav.json";
import themeConfig from "../content/config/theme.json";
import type { SiteConfig, NavItem, Theme } from "./schemas.js";

export function getSiteConfig(): SiteConfig {
  return siteConfig as SiteConfig;
}

export function getNav(): NavItem[] {
  return navConfig as NavItem[];
}

export function getTheme(): Theme {
  return themeConfig as Theme;
}
