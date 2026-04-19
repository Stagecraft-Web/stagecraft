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

export const siteConfigSchema = z.object({
  artistName: z.string().min(1),
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

// Keystatic `fields.conditional` serialises as { discriminant, value }.
// We validate that shape and transform it into { category, family } for
// downstream code, so the loader returns a clean, stable shape even as
// the Keystatic representation evolves.
const fontSelectionSchema = z
  .object({
    discriminant: fontCategoryEnum,
    value: z.string().min(1, "Font family is required"),
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

export const appearanceSchema = z.object({
  colors: z.object({
    primary: z.string().min(1),
    secondary: z.string().min(1),
    accent: z.string().min(1),
    background: z.string().min(1),
    surface: z.string().min(1),
    text: z.string().min(1),
    textMuted: z.string().min(1),
    border: z.string().min(1),
  }),
  typography: z.object({
    // "single" → primary is used for everything.
    // "split"  → heading uses `heading`, everything else uses `primary`.
    mode: z.enum(["single", "split"]).default("single"),
    primary: fontSelectionSchema,
    // Always present in the stored config so the JSON shape stays stable.
    // Only actually applied when `mode` is "split".
    heading: fontSelectionSchema,
    weights: z.object({
      body: fontWeightSchema.default(400),
      bodyBold: fontWeightSchema.default(700),
      h1: fontWeightSchema.default(700),
      h2: fontWeightSchema.default(700),
      h3: fontWeightSchema.default(700),
      h4: fontWeightSchema.default(700),
      h5: fontWeightSchema.default(600),
      h6: fontWeightSchema.default(600),
    }),
  }),
});

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
// Exported TypeScript types (derived from schemas)
// ============================================================

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type NavConfig = z.infer<typeof navConfigSchema>;
export type NavItem = z.infer<typeof navItemSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Video = z.infer<typeof videoSchema>;
export type PressQuote = z.infer<typeof pressQuoteSchema>;
export type TourDate = z.infer<typeof tourDateSchema>;
