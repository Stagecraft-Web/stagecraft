import { z } from "zod";

// ============================================================
// Image Metadata
// Canonical shape for every image reference in content files.
// Required: src, alt. All other fields are optional.
// ============================================================

export const imageMetadataSchema = z.object({
  src: z.string().min(1, "Image src is required"),
  alt: z.string().min(1, "Image alt text is required — do not leave blank"),
  caption: z.string().optional(),
  credit: z.string().optional(),   // e.g. "Photo by Jane Smith"
  focalPoint: z.object({           // crop/position hint, 0–1 range per axis
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }).optional(),
  usageSlot: z.enum([              // semantic slot — what this image is used for
    "hero", "about", "release-cover", "gallery", "press", "background", "thumbnail",
  ]).optional(),
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
  wordmark: wordmarkSchema.optional(),
  siteTitle: z.string().min(1),
  siteDescription: z.string(),
  socialLinks: z.record(z.string()),
  contactEmail: z.string().email(),
  copyright: z.string(),
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

const weightsSchema = z.object({
  body: fontWeightSchema.default(400),
  bodyBold: fontWeightSchema.default(700),
  h1: fontWeightSchema.default(700),
  h2: fontWeightSchema.default(700),
  h3: fontWeightSchema.default(700),
  h4: fontWeightSchema.default(700),
  h5: fontWeightSchema.default(600),
  h6: fontWeightSchema.default(600),
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
      heading: headingSelectionSchema,
      weights: weightsSchema,
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
      weights: input.typography.weights,
    },
  }));

export type Appearance = z.infer<typeof appearanceSchema>;
export type FontSelection = Appearance["typography"]["primary"];

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
});

// ============================================================
// Collections
// ============================================================

export const releaseSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["album", "single", "ep"]),
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

export const videoSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["youtube", "vimeo", "other"]),
  description: z.string().optional(),
});

export const pressQuoteSchema = z.object({
  quote: z.string().min(1),
  source: z.string().min(1),
  url: z.string().optional(),
  date: z.string().optional(),
});

export const tourDateSchema = z.object({
  date: z.string().min(1),
  venue: z.string().min(1),
  city: z.string().min(1),
  ticketUrl: z.string().optional(),
  status: z.enum(["upcoming", "sold_out", "canceled", "past"]),
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
