import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import type { SchemaContext } from "astro:content";

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
    usageSlot: z.enum(["hero", "about", "release-cover", "gallery", "press", "background", "thumbnail"]).optional(),
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
    headline: z.string().min(1).optional(),
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
      type: z.enum(["album", "single", "ep"]),
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
    type: z.enum(["youtube", "vimeo", "other"]),
    description: z.string().optional(),
  }),
});

const pressQuotes = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/pressQuotes" }),
  schema: z.object({
    quote: z.string().min(1),
    source: z.string().min(1),
    url: z.string().optional(),
    date: z.string().optional(),
  }),
});

const tourDates = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/collections/tourDates" }),
  schema: z.object({
    date: z.string().min(1),
    venue: z.string().min(1),
    city: z.string().min(1),
    ticketUrl: z.string().optional(),
    status: z.enum(["upcoming", "sold_out", "canceled", "past"]),
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
  pressQuotes,
  tourDates,
};
