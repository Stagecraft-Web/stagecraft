/**
 * Shared schema types for content-components.
 *
 * Each component's schema.ts exports a `markdoc` shape (consumed by
 * markdoc.config.ts) and a `keystatic` shape (consumed by keystatic.config.ts).
 * Those two configs never consume these types directly — they accept whatever
 * @astrojs/markdoc and @keystatic/core expect — but keeping a thin shared type
 * here documents the contract and guards against typos across components.
 */
import type { Schema } from "@markdoc/markdoc";
import type { ContentComponent } from "@keystatic/core/content-components";

/**
 * A markdoc tag definition. We alias Markdoc's native `Schema` type rather
 * than rolling our own narrower shape — this way new Schema fields Markdoc
 * supports (matches, slots, validate, etc.) are available without updating
 * this file. `Schema`'s second generic defaults to `string` which matches
 * our convention of storing `render` as a path string that markdoc.config.ts
 * wraps with `component(...)` when assembling the final config.
 */
export type MarkdocTagDefinition = Schema;

/**
 * A Keystatic content-component (either block or wrapper). The core library
 * exports a union `ContentComponent` that covers both — we re-export under
 * a clearer name so component files read as `KeystaticContentComponent`.
 */
export type KeystaticContentComponent = ContentComponent;

// ---------------------------------------------------------------------------
// Shared attribute enums
//
// These are the single source of truth for the string-literal unions used as
// Markdoc tag attribute values and Keystatic select options. Each component's
// schema.ts imports the const and derives its `matches: [...]` (markdoc) and
// `options: [...]` (keystatic) from it — no hand-rolled duplicates.
//
// Convention (see CLAUDE.md → "Enum single-source-of-truth convention"):
//   export const FOO_VALUES = ["a", "b", "c"] as const;
//   export type FooValue = (typeof FOO_VALUES)[number];
//   // optional sibling label record when display label != value
//   export const FOO_LABELS: Record<FooValue, string> = { … };
//
// The cross-schema consistency test in _shared/schema-consistency.test.ts
// asserts markdoc `matches` and keystatic `options` stay aligned.
//
// UI-only attribute enums live here; enums that describe the shape of
// content data (collections, frontmatter) live in src/lib/schemas.ts.
// ---------------------------------------------------------------------------

/** Heading level for `{% section %}` and `{% fullscreen-section %}` titles. */
export const HEADING_LEVELS = ["h1", "h2", "h3", "h4"] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
};

/** Visual variant for `{% button %}`. */
export const BUTTON_VARIANTS = ["primary", "outline"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_VARIANT_LABELS: Record<ButtonVariant, string> = {
  primary: "Primary",
  outline: "Outline",
};

/** Column-track ratio string for `{% columns %}` (dash-separated `fr` units). */
export const COLUMNS_LAYOUTS = ["1-1", "1-2", "2-1", "1-1-1"] as const;
export type ColumnsLayout = (typeof COLUMNS_LAYOUTS)[number];

export const COLUMNS_LAYOUT_LABELS: Record<ColumnsLayout, string> = {
  "1-1": "Equal (1:1)",
  "1-2": "Narrow + Wide (1:2)",
  "2-1": "Wide + Narrow (2:1)",
  "1-1-1": "Three Equal (1:1:1)",
};

/** Filter mode for `{% tour-dates-list %}`. */
export const TOUR_DATES_FILTERS = ["upcoming", "all"] as const;
export type TourDatesFilter = (typeof TOUR_DATES_FILTERS)[number];

export const TOUR_DATES_FILTER_LABELS: Record<TourDatesFilter, string> = {
  upcoming: "Upcoming only",
  all: "All dates",
};

/** Layout for `{% posts-list %}`. */
export const POSTS_LIST_LAYOUTS = ["grid", "list"] as const;
export type PostsListLayout = (typeof POSTS_LIST_LAYOUTS)[number];

export const POSTS_LIST_LAYOUT_LABELS: Record<PostsListLayout, string> = {
  grid: "Grid (cards)",
  list: "List (rows)",
};

/** Aspect ratio for `{% embed %}` iframes. */
export const EMBED_ASPECT_RATIOS = ["auto", "16/9", "4/3", "1/1"] as const;
export type EmbedAspectRatio = (typeof EMBED_ASPECT_RATIOS)[number];

export const EMBED_ASPECT_RATIO_LABELS: Record<EmbedAspectRatio, string> = {
  auto: "Auto (use iframe's own size)",
  "16/9": "16:9 (widescreen video)",
  "4/3": "4:3 (classic video)",
  "1/1": "1:1 (square)",
};

/** Newsletter provider for `{% newsletter-signup %}`. */
export const NEWSLETTER_SERVICES = [
  "mailchimp",
  "convertkit",
  "buttondown",
  "generic",
] as const;
export type NewsletterService = (typeof NEWSLETTER_SERVICES)[number];

export const NEWSLETTER_SERVICE_LABELS: Record<NewsletterService, string> = {
  mailchimp: "Mailchimp",
  convertkit: "ConvertKit",
  buttondown: "Buttondown",
  generic: "Generic (custom endpoint)",
};

/**
 * Embeddable video URL types for `{% video %}` — distinct from the
 * `VIDEO_TYPES` constant in `src/lib/schemas.ts`, which covers the
 * `videos` collection and includes "other" (rendered as a plain link).
 * The inline video block can only embed an iframe, so "other" is excluded.
 */
export const VIDEO_URL_TYPES = ["youtube", "vimeo"] as const;
export type VideoUrlType = (typeof VIDEO_URL_TYPES)[number];

export const VIDEO_URL_TYPE_LABELS: Record<VideoUrlType, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
};

/** Layout variant for `{% downloads %}` (wrapper). */
export const DOWNLOADS_LAYOUTS = ["list", "grid"] as const;
export type DownloadsLayout = (typeof DOWNLOADS_LAYOUTS)[number];

export const DOWNLOADS_LAYOUT_LABELS: Record<DownloadsLayout, string> = {
  list: "List",
  grid: "Grid",
};

/** Kind of file a `{% download %}` block represents. Drives the inline preview. */
export const DOWNLOAD_KINDS = [
  "photo",
  "audio",
  "video",
  "pdf",
  "other",
] as const;
export type DownloadKind = (typeof DOWNLOAD_KINDS)[number];

export const DOWNLOAD_KIND_LABELS: Record<DownloadKind, string> = {
  photo: "Photo",
  audio: "Audio",
  video: "Video",
  pdf: "PDF",
  other: "Other",
};
