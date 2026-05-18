/**
 * Pure conversion functions from the legacy on-disk shapes to the
 * collection `Item` shape (ADR-009 §13).
 *
 * The legacy shapes are what `lib/site-config-types.ts` describes:
 *
 *   - Pages: a Puck `Data` with `root.props = { title, isSplashPage,
 *     isFooterHidden }` and a flat `content` array.
 *   - Singletons: flat JSON conforming to `siteConfigSchema`,
 *     `headerConfigSchema`, or `appearanceSchema`.
 *
 * The new shape unifies everything into `Item` per `./schema.ts`. The
 * `content.ts` wrapper layer uses these conversions in both directions
 * — read goes through `*FromItem`, write goes through `*ToItem`.
 *
 * `generateItemId` is called from `*ToItemNew` (the "create" path).
 * Update paths preserve the existing id by reading the current item
 * first.
 */

import type { Data as PuckData } from "@measured/puck";

import type { ImageMetadata } from "../image-types";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
  type Appearance,
  type HeaderConfig,
  type PageRootProps,
  type SiteConfig,
  type SocialPlatform,
  COLOR_FIELDS,
  SOCIAL_PLATFORMS,
} from "../site-config-types";

import { generateItemId, type Item } from "./schema";
import {
  APPEARANCE_FIELD_IDS,
  HEADER_FIELD_IDS,
  PAGES_FIELD_IDS,
  SITE_FIELD_IDS,
} from "./seeds";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * Convert a Puck `Data` (the legacy page shape) plus its slug into an
 * `Item` for the pages collection. The page's root props (title, splash
 * flag, footer flag) become typed item field values; the content
 * array stays as a `puckContent` field value with an emptied root.
 *
 * `showInNav` defaults to true for migrated pages — they appeared in
 * the old nav unless `siteConfig.hiddenFromNav` excluded them. The
 * migration script wires that mapping at the call site.
 */
export function pageDataToItemValues(
  data: PuckData,
  opts: { showInNav?: boolean } = {},
): Item["values"] {
  const root = (data.root?.props ?? {}) as Partial<PageRootProps>;
  return {
    [PAGES_FIELD_IDS.title]: { type: "text", value: root.title ?? "Untitled" },
    [PAGES_FIELD_IDS.isSplashPage]: { type: "boolean", value: root.isSplashPage === true },
    [PAGES_FIELD_IDS.isFooterHidden]: { type: "boolean", value: root.isFooterHidden === true },
    [PAGES_FIELD_IDS.showInNav]: { type: "boolean", value: opts.showInNav ?? true },
    [PAGES_FIELD_IDS.body]: {
      type: "puckContent",
      // Strip the page-level root props from the body's Puck data —
      // they live on the item now, not on the body.
      value: { content: data.content ?? [], root: { props: {} } } as PuckData,
    },
  };
}

/** Build a brand-new pages item from legacy page data. */
export function pageDataToItem(
  slug: string,
  data: PuckData,
  opts: { id?: string; createdAt?: string; updatedAt?: string; showInNav?: boolean } = {},
): Item {
  const now = new Date().toISOString();
  return {
    id: opts.id ?? generateItemId(),
    slug,
    createdAt: opts.createdAt ?? now,
    updatedAt: opts.updatedAt ?? now,
    values: pageDataToItemValues(data, { showInNav: opts.showInNav }),
  };
}

/** Reconstruct the legacy `PuckData` shape from a pages item. */
export function pageDataFromItem(item: Item): PuckData {
  const body = item.values[PAGES_FIELD_IDS.body];
  const content =
    body && body.type === "puckContent" ? (body.value.content ?? []) : [];
  return {
    content,
    root: {
      props: {
        title: getString(item, PAGES_FIELD_IDS.title) ?? "Untitled",
        isSplashPage: getBoolean(item, PAGES_FIELD_IDS.isSplashPage) ?? false,
        isFooterHidden: getBoolean(item, PAGES_FIELD_IDS.isFooterHidden) ?? false,
      },
    },
  } as PuckData;
}

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

/**
 * Convert the legacy `SiteConfig` into the item values for the site
 * singleton. `pageOrder` and `hiddenFromNav` are NOT carried — the
 * Pages collection's `_order.json` + each page's `showInNav` field
 * own that data now (ADR-009 §14).
 */
export function siteConfigToItemValues(config: SiteConfig): Item["values"] {
  const values: Item["values"] = {
    [SITE_FIELD_IDS.artistName]: { type: "text", value: config.artistName },
    [SITE_FIELD_IDS.siteTitle]: { type: "text", value: config.siteTitle },
    [SITE_FIELD_IDS.siteDescription]: { type: "longText", value: config.siteDescription },
    [SITE_FIELD_IDS.contactEmail]: { type: "email", value: config.contactEmail },
    [SITE_FIELD_IDS.copyrightName]: { type: "text", value: config.copyrightName },
    [SITE_FIELD_IDS.isFooterHidden]: { type: "boolean", value: config.isFooterHidden },
  };
  for (const platform of SOCIAL_PLATFORMS) {
    const url = config.socialLinks[platform];
    // Empty social links are omitted so optional URL fields don't
    // record a failing-validation empty string. Renderers consult
    // hasField anyway.
    if (url && url.length > 0) {
      values[SITE_FIELD_IDS.social(platform)] = { type: "url", value: url };
    }
  }
  return values;
}

/** Reconstruct a `SiteConfig` from the site singleton item. */
export function siteConfigFromItem(item: Item | null): SiteConfig {
  if (!item) return DEFAULT_SITE_CONFIG;
  const socialLinks = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p, getString(item, SITE_FIELD_IDS.social(p)) ?? ""]),
  ) as Record<SocialPlatform, string>;
  return {
    artistName: getString(item, SITE_FIELD_IDS.artistName) ?? DEFAULT_SITE_CONFIG.artistName,
    siteTitle: getString(item, SITE_FIELD_IDS.siteTitle) ?? DEFAULT_SITE_CONFIG.siteTitle,
    siteDescription: getString(item, SITE_FIELD_IDS.siteDescription) ?? "",
    socialLinks,
    contactEmail:
      getString(item, SITE_FIELD_IDS.contactEmail) ?? DEFAULT_SITE_CONFIG.contactEmail,
    copyrightName: getString(item, SITE_FIELD_IDS.copyrightName) ?? "",
    isFooterHidden: getBoolean(item, SITE_FIELD_IDS.isFooterHidden) ?? false,
    // pageOrder + hiddenFromNav are derived from the Pages collection
    // (ADR-009 §14). Surfaced via separate accessors in content.ts.
    pageOrder: [],
    hiddenFromNav: [],
  };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function headerConfigToItemValues(config: HeaderConfig): Item["values"] {
  const values: Item["values"] = {
    [HEADER_FIELD_IDS.wordmarkSizeAdjust]: {
      type: "number",
      value: config.wordmarkSizeAdjust,
    },
    [HEADER_FIELD_IDS.headerMode]: { type: "select", value: config.headerMode },
    [HEADER_FIELD_IDS.headerForegroundColor]: {
      type: "text",
      value: config.headerForegroundColor,
    },
    [HEADER_FIELD_IDS.isHeaderTextUppercase]: {
      type: "boolean",
      value: config.isHeaderTextUppercase,
    },
    [HEADER_FIELD_IDS.headerSubtitle]: { type: "text", value: config.headerSubtitle },
    [HEADER_FIELD_IDS.headerLayout]: { type: "select", value: config.headerLayout },
  };
  if (config.wordmark !== null) {
    values[HEADER_FIELD_IDS.wordmark] = { type: "image", value: config.wordmark };
  }
  return values;
}

export function headerConfigFromItem(item: Item | null): HeaderConfig {
  if (!item) return DEFAULT_HEADER_CONFIG;
  const wordmarkValue = item.values[HEADER_FIELD_IDS.wordmark];
  const wordmark: ImageMetadata | null =
    wordmarkValue && wordmarkValue.type === "image" ? wordmarkValue.value : null;
  return {
    wordmark,
    wordmarkSizeAdjust: clampWordmarkSizeAdjust(
      getNumber(item, HEADER_FIELD_IDS.wordmarkSizeAdjust) ?? 0,
    ),
    headerMode:
      (getString(item, HEADER_FIELD_IDS.headerMode) as HeaderConfig["headerMode"]) ??
      DEFAULT_HEADER_CONFIG.headerMode,
    headerForegroundColor: getString(item, HEADER_FIELD_IDS.headerForegroundColor) ?? "",
    isHeaderTextUppercase: getBoolean(item, HEADER_FIELD_IDS.isHeaderTextUppercase) ?? false,
    headerSubtitle: getString(item, HEADER_FIELD_IDS.headerSubtitle) ?? "",
    headerLayout:
      (getString(item, HEADER_FIELD_IDS.headerLayout) as HeaderConfig["headerLayout"]) ??
      DEFAULT_HEADER_CONFIG.headerLayout,
  };
}

function clampWordmarkSizeAdjust(n: number): -2 | -1 | 0 | 1 | 2 {
  const r = Math.max(-2, Math.min(2, Math.round(n)));
  return r as -2 | -1 | 0 | 1 | 2;
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export function appearanceToItemValues(appearance: Appearance): Item["values"] {
  const values: Item["values"] = {};
  for (const color of COLOR_FIELDS) {
    values[APPEARANCE_FIELD_IDS.color(color)] = {
      type: "text",
      value: appearance.colors[color],
    };
  }
  values[APPEARANCE_FIELD_IDS.bodyFont] = {
    type: "text",
    value: appearance.typography.bodyFont,
  };
  values[APPEARANCE_FIELD_IDS.headingMode] = {
    type: "select",
    value: appearance.typography.headingMode,
  };
  values[APPEARANCE_FIELD_IDS.headingFont] = {
    type: "text",
    value: appearance.typography.headingFont,
  };
  values[APPEARANCE_FIELD_IDS.bodyWeight_body] = {
    type: "select",
    value: String(appearance.typography.bodyWeights.body),
  };
  values[APPEARANCE_FIELD_IDS.bodyWeight_bodyBold] = {
    type: "select",
    value: String(appearance.typography.bodyWeights.bodyBold),
  };
  values[APPEARANCE_FIELD_IDS.headingWeight_h1] = {
    type: "select",
    value: String(appearance.typography.headingWeights.h1),
  };
  values[APPEARANCE_FIELD_IDS.headingWeight_h2] = {
    type: "select",
    value: String(appearance.typography.headingWeights.h2),
  };
  values[APPEARANCE_FIELD_IDS.headingWeight_h3] = {
    type: "select",
    value: String(appearance.typography.headingWeights.h3),
  };
  return values;
}

export function appearanceFromItem(item: Item | null): Appearance {
  if (!item) return DEFAULT_APPEARANCE;
  const colors = Object.fromEntries(
    COLOR_FIELDS.map((c) => [
      c,
      getString(item, APPEARANCE_FIELD_IDS.color(c)) ?? DEFAULT_APPEARANCE.colors[c],
    ]),
  ) as Appearance["colors"];
  const weight = (id: string, fallback: number): number => {
    const raw = getString(item, id);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    colors,
    typography: {
      bodyFont:
        getString(item, APPEARANCE_FIELD_IDS.bodyFont) ?? DEFAULT_APPEARANCE.typography.bodyFont,
      headingMode:
        (getString(item, APPEARANCE_FIELD_IDS.headingMode) as Appearance["typography"]["headingMode"]) ??
        DEFAULT_APPEARANCE.typography.headingMode,
      headingFont: getString(item, APPEARANCE_FIELD_IDS.headingFont) ?? "",
      bodyWeights: {
        body: weight(APPEARANCE_FIELD_IDS.bodyWeight_body, 400) as Appearance["typography"]["bodyWeights"]["body"],
        bodyBold: weight(
          APPEARANCE_FIELD_IDS.bodyWeight_bodyBold,
          700,
        ) as Appearance["typography"]["bodyWeights"]["bodyBold"],
      },
      headingWeights: {
        h1: weight(APPEARANCE_FIELD_IDS.headingWeight_h1, 700) as Appearance["typography"]["headingWeights"]["h1"],
        h2: weight(APPEARANCE_FIELD_IDS.headingWeight_h2, 700) as Appearance["typography"]["headingWeights"]["h2"],
        h3: weight(APPEARANCE_FIELD_IDS.headingWeight_h3, 700) as Appearance["typography"]["headingWeights"]["h3"],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Small value extractors (untyped fallbacks for the conversion paths)
// ---------------------------------------------------------------------------

function getString(item: Item, fieldId: string): string | null {
  const v = item.values[fieldId];
  if (!v) return null;
  switch (v.type) {
    case "text":
    case "longText":
    case "date":
    case "url":
    case "email":
    case "color":
    case "select":
      return v.value;
    default:
      return null;
  }
}

function getBoolean(item: Item, fieldId: string): boolean | null {
  const v = item.values[fieldId];
  return v && v.type === "boolean" ? v.value : null;
}

function getNumber(item: Item, fieldId: string): number | null {
  const v = item.values[fieldId];
  return v && v.type === "number" ? v.value : null;
}

/** Re-export so the migration script + tests have one source of truth. */
export type LegacyPageInputs = {
  slug: string;
  data: PuckData;
  showInNav: boolean;
};
