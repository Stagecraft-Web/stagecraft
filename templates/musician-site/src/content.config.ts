import { defineCollection } from "astro:content";
import { glob, file } from "astro/loaders";
import { z } from "astro/zod";

// ---------------------------------------------------------------------------
// Schemas (using astro/zod for content collection compatibility)
//
// These mirror the schemas in src/lib/schemas.ts. That file uses zod v3 for
// the validation script and runtime types; this file uses Astro's bundled
// zod v4 as required by the content collections API.
// ---------------------------------------------------------------------------

const imageMetadataSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  credit: z.string().optional(),
  focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  usageSlot: z.enum(["hero", "about", "release-cover", "gallery", "press", "background", "thumbnail"]).optional(),
});

// ---------------------------------------------------------------------------
// Pages — one collection per page type (each has a different schema)
// ---------------------------------------------------------------------------

const homePage = defineCollection({
  loader: glob({ pattern: "home.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
    subheadline: z.string().optional(),
    heroImage: z.string().optional(),
    ctaText: z.string().optional(),
    ctaLink: z.string().optional(),
  }),
});

const aboutPage = defineCollection({
  loader: glob({ pattern: "about.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
    image: z.string().optional(),
  }),
});

const musicPage = defineCollection({
  loader: glob({ pattern: "music.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
  }),
});

const photosPage = defineCollection({
  loader: glob({ pattern: "photos.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
  }),
});

const pressPage = defineCollection({
  loader: glob({ pattern: "press.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
    reviewsHeadline: z.string().optional(),
    epkDownload: z.string().optional(),
  }),
});

const contactPage = defineCollection({
  loader: glob({ pattern: "contact.mdoc", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    headline: z.string().min(1),
  }),
});

// ---------------------------------------------------------------------------
// Collections — JSON data
// ---------------------------------------------------------------------------

const releases = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/collections/releases" }),
  schema: z.object({
    title: z.string().min(1),
    type: z.enum(["album", "single", "ep"]),
    releaseDate: z.string().min(1),
    coverImage: imageMetadataSchema,
    description: z.string(),
    links: z.record(z.string(), z.string()),
    tracks: z.array(z.object({
      title: z.string().min(1),
      duration: z.string().min(1),
    })).optional(),
  }),
});

const photos = defineCollection({
  loader: file("src/content/collections/photos/gallery.json"),
  schema: imageMetadataSchema,
});

const videos = defineCollection({
  loader: file("src/content/collections/videos/videos.json"),
  schema: z.object({
    title: z.string().min(1),
    url: z.url(),
    type: z.enum(["youtube", "vimeo", "other"]),
    description: z.string().optional(),
  }),
});

const pressQuotes = defineCollection({
  loader: file("src/content/collections/pressQuotes/quotes.json"),
  schema: z.object({
    quote: z.string().min(1),
    source: z.string().min(1),
    url: z.string().optional(),
    date: z.string().optional(),
  }),
});

const tourDates = defineCollection({
  loader: file("src/content/collections/tourDates/dates.json"),
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
  homePage,
  aboutPage,
  musicPage,
  photosPage,
  pressPage,
  contactPage,
  releases,
  photos,
  videos,
  pressQuotes,
  tourDates,
};
