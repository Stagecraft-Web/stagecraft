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

// Nav config — what's stored in nav.json (source of ordering truth).
// Each entry references a page slug and provides a display label.
export const navConfigItemSchema = z.object({
  page: z.string().min(1),
  label: z.string().min(1),
});

export const navConfigSchema = z.object({
  items: z.array(navConfigItemSchema),
});

// Resolved nav item — what Header.astro actually renders (derived at build time
// from nav.json, filtered to pages that exist).
export const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

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
// All pages share a minimal frontmatter shape: title + headline.
// Page-specific structured content (hero sections, images, EPK
// links) lives in the Markdoc body as custom tags, not frontmatter.
// ============================================================

export const pageFrontmatterSchema = z.object({
  title: z.string().min(1),
  headline: z.string().min(1),
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
export type NavConfigItem = z.infer<typeof navConfigItemSchema>;
export type NavConfig = z.infer<typeof navConfigSchema>;
export type NavItem = z.infer<typeof navItemSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;
export type Release = z.infer<typeof releaseSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Video = z.infer<typeof videoSchema>;
export type PressQuote = z.infer<typeof pressQuoteSchema>;
export type TourDate = z.infer<typeof tourDateSchema>;
