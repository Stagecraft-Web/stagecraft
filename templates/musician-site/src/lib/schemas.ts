import { z } from "zod";

// ============================================================
// Image Metadata
// Canonical shape for every image reference in content files.
// Required: src, alt. All other fields are optional.
// ============================================================

// Semantic "what is this image used for" slot. A single canonical list; the
// Keystatic per-collection selects (photos / releases / storeItems) filter
// this down to the subset that makes sense for each collection.
export const IMAGE_USAGE_SLOTS = [
  "hero",
  "about",
  "release-cover",
  "gallery",
  "press",
  "background",
  "thumbnail",
] as const;
export type ImageUsageSlot = (typeof IMAGE_USAGE_SLOTS)[number];

// Human-friendly labels for the Keystatic Usage Slot select(s). Labels are
// title-cased; some values need specific casing ("release-cover" → "Release
// cover" rather than "Release-cover").
export const IMAGE_USAGE_SLOT_LABELS: Record<ImageUsageSlot, string> = {
  hero: "Hero",
  about: "About",
  "release-cover": "Release cover",
  gallery: "Gallery",
  press: "Press",
  background: "Background",
  thumbnail: "Thumbnail",
};

export const imageMetadataSchema = z.object({
  src: z.string().min(1, "Image src is required"),
  alt: z.string().min(1, "Image alt text is required — do not leave blank"),
  caption: z.string().optional(),
  credit: z.string().optional(),   // e.g. "Photo by Jane Smith"
  focalPoint: z.object({           // crop/position hint, 0–1 range per axis
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }).optional(),
  usageSlot: z.enum(IMAGE_USAGE_SLOTS).optional(), // semantic slot — what this image is used for
});

// ============================================================
// Config singletons
// ============================================================

// Brand wordmark image. When set, the header renders this image in place of
// the artist-name text. Shape is intentionally minimal — we only need src +
// alt. Optional because most sites are fine with plain text.
//
// `alt` is required when present: the image replaces the visible artist name
// for sighted users, and screen readers depend on it to know who the site
// belongs to.
export const wordmarkSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
});

export const siteConfigSchema = z.object({
  artistName: z.string().min(1),
  // Keystatic's fields.object writes `"wordmark": {}` when the inner
  // image + text fields are both blank — indistinguishable from "no
  // wordmark set". Coerce that to undefined so .optional() accepts it.
  wordmark: z
    .preprocess((val) => {
      if (
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Object.keys(val).length === 0
      ) {
        return undefined;
      }
      return val;
    }, wordmarkSchema.optional()),
  // Site favicon (path to uploaded asset). When set, the <link rel="icon">
  // in BaseLayout points here instead of the default `/favicons/favicon.svg`
  // shipped in `public/`.
  favicon: z.string().min(1).optional(),
  siteTitle: z.string().min(1),
  siteDescription: z.string(),
  socialLinks: z.record(z.string()),
  contactEmail: z.string().email(),
  // Who holds copyright for the site. The footer renders
  //   "© {current year} {copyrightName || artistName}. All rights reserved."
  // Authors only need to set this when copyright is held under a name
  // that differs from the performer's stage name (e.g. legal entity or
  // civil name); leaving it blank falls back to `artistName`.
  copyrightName: z.string().optional(),
  // Hide the site-level social-links/copyright footer across every page.
  // Per-page frontmatter may override (`isFooterHidden` in pageFrontmatterSchema).
  // Default false = footer visible (common-sense default).
  isFooterHidden: z.boolean().default(false),
});

// Nav config — what's stored in nav.json.
// An ordered array of page slugs. The Navigation singleton owns both
// membership (which pages appear) and order (what sequence).
// Uses fields.relationship in Keystatic, so each entry is a page slug.
export const navConfigSchema = z.object({
  items: z.array(z.string().min(1)),
});

// Resolved nav item — what Header.astro actually renders (derived at build
// time by looking up each slug's page title for the label).
export const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

// ============================================================
// Appearance — the user-editable subset of theme (colors + typography).
//
// Stored in `src/content/config/appearance.json` and exposed as the
// "Appearance" singleton in Keystatic. BaseLayout reads this to build
// the Google Fonts <link> (requesting only the exact weights in use)
// and to inject CSS custom properties for colors / font stacks.
//
// The older `theme.json` remains for dev-level tokens (font sizes,
// spacing, breakpoints) that are not exposed in the CMS.
// ============================================================

export const FONT_CATEGORIES = [
  "sans-serif",
  "serif",
  "monospace",
  "display",
  "handwriting",
  "custom",
] as const;

const fontCategoryEnum = z.enum(FONT_CATEGORIES);
export type FontCategory = (typeof FONT_CATEGORIES)[number];

// Human-friendly labels for each font category. Consumed by both the
// Keystatic picker (keystatic.config.ts) and the appearance sidebar
// (src/components/appearance-sidebar/AppearanceSidebar.tsx) so both UIs
// stay in lock-step.
export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  "sans-serif": "Sans-serif",
  serif: "Serif",
  monospace: "Monospace",
  display: "Display",
  handwriting: "Handwriting",
  custom: "Custom (any Google Font)",
};

// Google Fonts family names: start with a capital, then letters / digits /
// spaces only. Catches typos like "space grotesk" or trailing punctuation
// that would otherwise hit the Google Fonts server as a 404.
const GOOGLE_FONT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*(?: [A-Za-z0-9][A-Za-z0-9]*)*$/;

// Keystatic `fields.conditional` serialises as { discriminant, value }.
// We validate that shape and transform it into { category, family } for
// downstream code, so the loader returns a clean, stable shape even as
// the Keystatic representation evolves.
//
// When discriminant === "custom", the value is a free-text family name
// and we apply the Google Fonts pattern check. When discriminant is a
// curated category, the value comes from a select of known families, so
// format checks aren't needed (any non-empty string is fine).
const fontSelectionSchema = z
  .object({
    discriminant: fontCategoryEnum,
    value: z.string().min(1, "Font family is required"),
  })
  .superRefine((input, ctx) => {
    if (input.discriminant === "custom" && !GOOGLE_FONT_NAME_PATTERN.test(input.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          "Custom font name must match Google Fonts format: start with a capital letter, contain only letters / digits / spaces (e.g. 'Space Grotesk', 'IBM Plex Sans').",
      });
    }
  })
  .transform((input) => ({
    category: input.discriminant,
    family: input.value,
  }));

// Keystatic `fields.select` stores values as strings ("400" rather than 400),
// so coerce before validating. This also means a JSON author can write either
// 400 or "400" and both will work.
const fontWeightSchema = z.coerce
  .number()
  .int()
  .min(100)
  .max(900)
  .refine((w) => w % 100 === 0, { message: "Weight must be a multiple of 100 (100–900)" });

// Heading font is stored as a Keystatic conditional keyed on mode:
//   - "single" → no heading-specific font; body font is used for everything
//   - "split"  → value is the heading FontSelection
// We validate that discriminated union and transform it into a flat
// { mode, heading } pair so downstream code doesn't need to unwrap Keystatic
// internals.
const headingSelectionSchema = z
  .discriminatedUnion("discriminant", [
    z.object({ discriminant: z.literal("single"), value: z.null() }),
    z.object({ discriminant: z.literal("split"), value: fontSelectionSchema }),
  ])
  .transform((input) =>
    input.discriminant === "single"
      ? { mode: "single" as const, heading: null }
      : { mode: "split" as const, heading: input.value },
  );

// Per-bucket font-size overrides. Each key matches the eight buckets in
// theme.json (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`); a missing
// or empty value falls back to the theme.json baseline at render time. Stored
// as rem strings ("1.25rem") so the on-disk format mirrors theme.json.
//
// Replaces the earlier `fontSizeScale` / `fontSizeAdjust` / `headingScale`
// multipliers — per-bucket overrides give authors the same expressiveness
// without three layered knobs.
export const FONT_SIZE_BUCKETS = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
] as const;
export type FontSizeBucket = (typeof FONT_SIZE_BUCKETS)[number];

// Buckets driven primarily by heading-level CSS (xl → h4, 2xl → h3, 3xl → h2,
// 4xl → h1). Used by the Keystatic + sidebar grouping that splits the size
// editor into a Body group and a Headings group. Both arrays are listed
// largest-first so the admin UI reads top-down from "h1 / large body" down
// to "captions" — the order an author scans when tuning the type scale.
export const HEADING_FONT_SIZE_BUCKETS = ["4xl", "3xl", "2xl", "xl"] as const;
export type HeadingFontSizeBucket = (typeof HEADING_FONT_SIZE_BUCKETS)[number];
export const BODY_FONT_SIZE_BUCKETS = ["lg", "base", "sm", "xs"] as const;
export type BodyFontSizeBucket = (typeof BODY_FONT_SIZE_BUCKETS)[number];

// Friendly labels — used by both the Keystatic admin and the in-page sidebar.
// Pairs the bucket key with a hint about which heading level (if any) it
// drives in `global.css`.
export const FONT_SIZE_BUCKET_LABELS: Record<FontSizeBucket, string> = {
  xs: "xs (caption)",
  sm: "sm (small body)",
  base: "base (body / h6)",
  lg: "lg (large body / h5)",
  xl: "xl (h4)",
  "2xl": "2xl (h3)",
  "3xl": "3xl (h2)",
  "4xl": "4xl (h1)",
};

// Per-bucket sizes are stored as integer pixels with a 16px = 1rem
// convention. `0` means "fall back to the theme.json baseline at render
// time" — the stepper UI in both surfaces treats 0 as "default" and steps
// up to 8px (0.5rem) on first increment. Bounded to [0, 96] (0.5rem to
// 6rem) so the steppers can't run off into ridiculous territory.
//
// Why pixels (not rem strings)? A constrained integer prevents authors
// from typing free-form values like "1.347rem" or "16px" — the stepper
// can only emit valid values, and `fields.integer` gives Keystatic a
// native number input with +/− buttons.
export const PX_PER_REM = 16;
export const FONT_SIZE_PX_MIN = 0;
export const FONT_SIZE_PX_MAX = 96;
export const FONT_SIZE_PX_STEP_MIN = 8;

const fontSizePxSchema = z.coerce
  .number()
  .int()
  .min(FONT_SIZE_PX_MIN)
  .max(FONT_SIZE_PX_MAX);

// Builds a `{bucket: schema, ...}` map for a fixed set of buckets so the Zod
// shape preserves the literal-union types. Without this helper the shape is
// inferred as `{[k: string]: ...}` and downstream `.default()` calls lose
// type-safety.
const sizesShapeFor = <T extends FontSizeBucket>(
  buckets: readonly T[],
): Record<T, ReturnType<typeof fontSizePxSchema.default>> =>
  buckets.reduce(
    (acc, bucket) => {
      acc[bucket] = fontSizePxSchema.default(0);
      return acc;
    },
    {} as Record<T, ReturnType<typeof fontSizePxSchema.default>>,
  );

// Helper: builds a `Record<bucket, 0>` for the schema's top-level default.
// Each individual bucket's `.default(0)` would suffice when the parent block
// is supplied, but the parent itself also needs a default for the case where
// `bodySizes` / `headingSizes` is missing entirely (e.g. an old
// `appearance.json` from before the size block existed).
const blankSizesFor = <T extends string>(buckets: readonly T[]): Record<T, number> =>
  buckets.reduce(
    (acc, bucket) => {
      acc[bucket] = 0;
      return acc;
    },
    {} as Record<T, number>,
  );

const bodySizesSchema = z
  .object(sizesShapeFor(BODY_FONT_SIZE_BUCKETS))
  .default(() => blankSizesFor(BODY_FONT_SIZE_BUCKETS));

const headingSizesSchema = z
  .object(sizesShapeFor(HEADING_FONT_SIZE_BUCKETS))
  .default(() => blankSizesFor(HEADING_FONT_SIZE_BUCKETS));

// Body and heading weight blocks are split so the admin can group them with
// their respective font + sizes. h5 / h6 weights are intentionally not
// surfaced — global.css's `@layer defaults` provides sensible fallbacks
// (semibold) and authors who really need to change them can edit the
// stylesheet directly.
const bodyWeightsSchema = z.object({
  body: fontWeightSchema.default(400),
  bodyBold: fontWeightSchema.default(700),
});

const headingWeightsSchema = z.object({
  h1: fontWeightSchema.default(700),
  h2: fontWeightSchema.default(700),
  h3: fontWeightSchema.default(700),
  h4: fontWeightSchema.default(700),
});

export const appearanceSchema = z
  .object({
    colors: z.object({
      primary: z.string().min(1),
      secondary: z.string().min(1),
      accent: z.string().min(1),
      // Optional distinct link color. When unset (missing or empty string),
      // the transform below falls back to `accent`, so downstream code can
      // always read `colors.linkColor` without a null check. Keystatic stores
      // empty text inputs as `""`, so we accept both `undefined` and `""` as
      // "unset." Sites that want links to read differently from the accent/CTA
      // color (e.g. a Pumpkin Bread–style wordmark site) set this explicitly.
      linkColor: z.string().optional(),
      background: z.string().min(1),
      surface: z.string().min(1),
      text: z.string().min(1),
      textMuted: z.string().min(1),
      border: z.string().min(1),
    }),
    typography: z.object({
      primary: fontSelectionSchema,
      bodySizes: bodySizesSchema,
      bodyWeights: bodyWeightsSchema.default({}),
      heading: headingSelectionSchema,
      headingSizes: headingSizesSchema,
      headingWeights: headingWeightsSchema.default({}),
    }),
  })
  .transform((input) => ({
    colors: {
      ...input.colors,
      // Unset linkColor (missing OR empty string) inherits from accent, so
      // downstream emitters and the sidebar never have to branch on null.
      linkColor:
        input.colors.linkColor && input.colors.linkColor.length > 0
          ? input.colors.linkColor
          : input.colors.accent,
    },
    typography: {
      primary: input.typography.primary,
      mode: input.typography.heading.mode,
      heading: input.typography.heading.heading,
      // Body and heading size/weight blocks stay split in the runtime shape
      // too — consumers (BaseLayout, live-preview) can compose them into a
      // single CSS-variable map without losing the grouping. Each per-bucket
      // value is either an explicit rem string ("1.25rem") or "" (use the
      // theme.json baseline).
      bodySizes: input.typography.bodySizes,
      bodyWeights: input.typography.bodyWeights,
      headingSizes: input.typography.headingSizes,
      headingWeights: input.typography.headingWeights,
    },
  }));

export type Appearance = z.infer<typeof appearanceSchema>;
export type FontSelection = Appearance["typography"]["primary"];
export type AppearanceTypography = Appearance["typography"];

export const themeSchema = z.object({
  colorMode: z.enum(["light", "dark"]).default("light"),
  colors: z.record(z.string()),
  darkColors: z.record(z.string()).optional(),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
    fontSize: z.record(z.string()),
    fontWeight: z.record(z.string()),
  }),
  spacing: z.record(z.string()),
  breakpoints: z.record(z.string()),
  layout: z.object({
    maxContentWidth: z.string(),
    maxTextWidth: z.string(),
    borderRadius: z.string(),
  }),
});

// ============================================================
// Page frontmatter schema
// All pages share minimal frontmatter: just a title.
// Page-specific structured content (sections, images, buttons,
// columns) lives in the Markdoc body as custom tags, not frontmatter.
//
// Navigation membership is controlled by the Navigation singleton
// (nav.json), not by page frontmatter.
// ============================================================

export const pageFrontmatterSchema = z.object({
  title: z.string().min(1),
  // When true, this page takes over `/` and renders without the site header
  // or footer. The regular "home" page (if any) auto-moves to `/home`.
  // Only one page may be marked as a splash.
  isSplashPage: z.boolean().optional(),
  // Per-page override for the site-level footer toggle. When set, this value
  // wins for this page only; leave unset to inherit the site-level default.
  isFooterHidden: z.boolean().optional(),
});

// ============================================================
// Collections
// ============================================================

// Release type — coarse category for a music release. Distinct from
// STORE_ITEM_FORMATS, which covers both releases and merch (the store side).
export const RELEASE_TYPES = ["album", "single", "ep"] as const;
export type ReleaseType = (typeof RELEASE_TYPES)[number];

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  album: "Album",
  single: "Single",
  ep: "EP",
};

export const releaseSchema = z.object({
  title: z.string().min(1),
  type: z.enum(RELEASE_TYPES),
  releaseDate: z.string().min(1),
  coverImage: imageMetadataSchema,
  description: z.string(),
  links: z.record(z.string()),
  tracks: z.array(z.object({
    title: z.string().min(1),
    duration: z.string().min(1),
  })).optional(),
});

// photoSchema extends imageMetadataSchema — gallery entries carry the full
// image metadata shape (src + alt required, caption/credit/focalPoint/usageSlot optional).
export const photoSchema = imageMetadataSchema;

// Platforms the Videos collection can record. "other" is a catch-all for
// self-hosted or non-YouTube/Vimeo platforms; collection consumers render it
// as a plain link. The {% video %} content-component only accepts the two
// embeddable platforms — see VIDEO_URL_TYPES in Video/schema.ts.
export const VIDEO_TYPES = ["youtube", "vimeo", "other"] as const;
export type VideoPlatform = (typeof VIDEO_TYPES)[number];

export const VIDEO_TYPE_LABELS: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  other: "Other",
};

export const videoSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  type: z.enum(VIDEO_TYPES),
  description: z.string().optional(),
});

export const pressQuoteSchema = z.object({
  quote: z.string().min(1),
  source: z.string().min(1),
  url: z.string().optional(),
  date: z.string().optional(),
});

// Show status for a tour date. Matches the four states the TourDatesList
// block filters / badges on. `sold_out` uses an underscore (rather than the
// kebab style elsewhere) because it's an older field and authored content
// may depend on it.
export const TOUR_DATE_STATUSES = [
  "upcoming",
  "sold_out",
  "canceled",
  "past",
] as const;
export type TourDateStatus = (typeof TOUR_DATE_STATUSES)[number];

export const TOUR_DATE_STATUS_LABELS: Record<TourDateStatus, string> = {
  upcoming: "Upcoming",
  sold_out: "Sold Out",
  canceled: "Canceled",
  past: "Past",
};

export const tourDateSchema = z.object({
  date: z.string().min(1),
  venue: z.string().min(1),
  city: z.string().min(1),
  ticketUrl: z.string().optional(),
  status: z.enum(TOUR_DATE_STATUSES),
});

// ============================================================
// Posts / news
//
// Unlike the yaml-backed collections above, posts are `.mdoc` files
// with rich bodies (frontmatter + markdoc body). The frontmatter is
// validated against postFrontmatterSchema; the body is Markdoc and
// can embed the same content-components that regular pages do.
//
// POST_CATEGORIES is shared between the frontmatter schema and the
// `posts-list` markdoc tag's category filter. Adding a category here
// automatically makes it available everywhere that uses the constant.
// ============================================================

export const POST_CATEGORIES = [
  "news",
  "blog",
  "update",
  "press",
  "release",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  publishedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)"),
  featuredImage: imageMetadataSchema.optional(),
  excerpt: z.string().max(300).optional(),
  category: z.enum(POST_CATEGORIES).default("news"),
  externalUrl: z.string().url().optional(),
  status: z.enum(POST_STATUSES).default("published"),
});

// ============================================================
// Store items — merch, album sales, digital downloads for purchase.
// Structurally analogous to releases, but with a Buy URL and purchase
// status (available / sold-out / preorder). Rendered via the
// `store-items` block.
//
// This file is the single source of truth for every store-related enum
// (formats, statuses, list filters, list layouts). All other modules —
// `src/content-components/StoreItemList/schema.ts`, the Astro renderer,
// `_shared/types.ts`, etc. — import from here rather than redeclaring.
// ============================================================

// Format is a coarse category the artist assigns to each item. Earlier
// revisions enumerated every physical/digital variant (album-cd, album-
// vinyl, ep-digital, …); the product decision is to keep it coarse and
// let the artist explain "multiple formats available" in the description.
export const STORE_ITEM_FORMATS = ["album", "ep", "single", "merch"] as const;
export type StoreItemFormat = (typeof STORE_ITEM_FORMATS)[number];

export const STORE_ITEM_STATUSES = ["available", "sold-out", "preorder"] as const;
export type StoreItemStatus = (typeof STORE_ITEM_STATUSES)[number];

// Filter + layout enums for the `store-items` markdoc tag. Kept here (rather
// than in the component's schema.ts) so the StoreItemList renderer and any
// future consumers can import them from a single location.
export const STORE_ITEM_LIST_FILTERS = ["all", "available", "preorder"] as const;
export type StoreItemListFilter = (typeof STORE_ITEM_LIST_FILTERS)[number];

export const STORE_ITEM_LIST_LAYOUTS = ["grid", "list"] as const;
export type StoreItemListLayout = (typeof STORE_ITEM_LIST_LAYOUTS)[number];

// Price is a numeric amount; currency is a separate ISO 4217 code with a
// USD default. Rendering uses `Intl.NumberFormat` to produce a locale-
// aware, currency-correct display string.
export const storeItemSchema = z.object({
  title: z.string().min(1),
  format: z.enum(STORE_ITEM_FORMATS),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  image: imageMetadataSchema.optional(),
  description: z.string().optional(),
  buyUrl: z.string().url(),
  status: z.enum(STORE_ITEM_STATUSES).default("available"),
  order: z.number().int().optional(),
});

// ============================================================
// Exported TypeScript types (derived from schemas)
// ============================================================

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type Wordmark = z.infer<typeof wordmarkSchema>;
export type NavConfig = z.infer<typeof navConfigSchema>;
export type NavItem = z.infer<typeof navItemSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Video = z.infer<typeof videoSchema>;
export type PressQuote = z.infer<typeof pressQuoteSchema>;
export type TourDate = z.infer<typeof tourDateSchema>;
export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;
export type StoreItem = z.infer<typeof storeItemSchema>;
