import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import type { SchemaContext } from "astro:content";
import {
  IMAGE_USAGE_SLOTS,
  POST_CATEGORIES,
  POST_STATUSES,
  RELEASE_TYPES,
  STORE_ITEM_FORMATS,
  STORE_ITEM_STATUSES,
  TOUR_DATE_STATUSES,
  VIDEO_TYPES,
} from "./lib/schemas";

// ---------------------------------------------------------------------------
// Schemas (using astro/zod for content collection compatibility)
//
// These mirror the schemas in src/lib/schemas.ts. That file uses zod v3 for
// the validation script and runtime types; this file uses Astro's bundled
// zod v4 as required by the content collections API.
//
// Image fields use Astro's image() helper so that images in src/assets/ are
// optimised at build time (format conversion, responsive srcset, dimensions).
// ---------------------------------------------------------------------------

const imageMetadataSchema = ({ image }: SchemaContext) =>
  z.object({
    src: image(),
    alt: z.string().min(1),
    caption: z.string().optional(),
    credit: z.string().optional(),
    focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
    usageSlot: z.enum(IMAGE_USAGE_SLOTS).optional(),
  });

// ---------------------------------------------------------------------------
// Pages — unified collection with minimal shared frontmatter.
// Page-specific structured content (hero sections, images, EPK links) lives
// in the Markdoc body as custom tags, not in frontmatter.
// ---------------------------------------------------------------------------

const pages = defineCollection({
  loader: glob({ pattern: "*.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    // When true, the page renders without the site header or footer — used
    // for splash / landing pages that display a full-bleed hero and a single
    // "enter site" link. Pair with a `{% fullscreen-section %}` + `{% button %}`
    // in the body for the classic splash layout.
    isSplashPage: z.boolean().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Collections — YAML data
// ---------------------------------------------------------------------------

const releases = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/releases" }),
  schema: (ctx) =>
    z.object({
      title: z.string().min(1),
      type: z.enum(RELEASE_TYPES),
      releaseDate: z.string().min(1),
      coverImage: imageMetadataSchema(ctx),
      description: z.string(),
      links: z.record(z.string(), z.string()),
      tracks: z.array(z.object({
        title: z.string().min(1),
        duration: z.string().min(1),
      })).optional(),
    }),
});

const photos = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/photos" }),
  schema: (ctx) => imageMetadataSchema(ctx),
});

const videos = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/videos" }),
  schema: z.object({
    title: z.string().min(1),
    url: z.url(),
    type: z.enum(VIDEO_TYPES),
    description: z.string().optional(),
  }),
});

const tourDates = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/tourDates" }),
  schema: z.object({
    date: z.string().min(1),
    venue: z.string().min(1),
    city: z.string().min(1),
    ticketUrl: z.string().optional(),
    status: z.enum(TOUR_DATE_STATUSES),
  }),
});

// Store items. Mirrors the `releases` collection shape (yaml-per-file with an
// optional image metadata block) but adds a purchase status + buy URL so the
// `store-items` block can render a styled merch/album grid.
const storeItems = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/storeItems" }),
  schema: (ctx) =>
    z.object({
      title: z.string().min(1),
      format: z.enum(STORE_ITEM_FORMATS),
      price: z.number().nonnegative(),
      currency: z.string().length(3).default("USD"),
      image: imageMetadataSchema(ctx).optional(),
      description: z.string().optional(),
      buyUrl: z.url(),
      status: z.enum(STORE_ITEM_STATUSES).default("available"),
      order: z.number().int().optional(),
    }),
});

// ---------------------------------------------------------------------------
// Posts — `.mdoc` collection with rich body + frontmatter.
//
// The shape here mirrors `postFrontmatterSchema` in src/lib/schemas.ts, which
// is used by the validate-content script (zod v3). Keeping the two in sync is
// required — the schema-consistency test covers markdoc↔keystatic parity, but
// not this one. If POST_CATEGORIES changes in schemas.ts, update the enum
// here too.
// ---------------------------------------------------------------------------

const posts = defineCollection({
  loader: glob({ pattern: "**/*.mdoc", base: "./src/content/collections/posts" }),
  schema: (ctx) =>
    z.object({
      title: z.string().min(1),
      publishedDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)"),
      featuredImage: imageMetadataSchema(ctx).optional(),
      excerpt: z.string().max(300).optional(),
      category: z.enum(POST_CATEGORIES).default("news"),
      externalUrl: z.url().optional(),
      status: z.enum(POST_STATUSES).default("published"),
    }),
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const collections = {
  pages,
  releases,
  photos,
  videos,
  tourDates,
  posts,
  storeItems,
};
