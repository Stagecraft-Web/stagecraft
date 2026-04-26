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
 * Curated subset of HTML `autocomplete` tokens for newsletter-field tags.
 * Limited to values that make sense for a newsletter signup so the keystatic
 * picker stays scannable; the full HTML spec list is much longer but most of
 * it (credit-card, shipping address, OTP, …) has no place on a mailing-list
 * form. "off" disables autofill entirely for the field.
 */
export const AUTOCOMPLETE_TOKENS = [
  "off",
  "name",
  "given-name",
  "additional-name",
  "family-name",
  "nickname",
  "email",
  "tel",
  "organization",
  "organization-title",
  "country-name",
  "postal-code",
  "bday",
] as const;
export type AutocompleteToken = (typeof AUTOCOMPLETE_TOKENS)[number];

export const AUTOCOMPLETE_TOKEN_LABELS: Record<AutocompleteToken, string> = {
  off: "Off (no autofill)",
  name: "Full name",
  "given-name": "First name",
  "additional-name": "Middle name",
  "family-name": "Last name",
  nickname: "Nickname",
  email: "Email",
  tel: "Phone",
  organization: "Organization / company",
  "organization-title": "Job title",
  "country-name": "Country",
  "postal-code": "Postal / ZIP code",
  bday: "Birthday",
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

// ---------------------------------------------------------------------------
// Card — the generic tile primitive used both directly as `{% card %}` and
// internally by specialised list components (ReleaseList, PostsList) that
// render a Card per collection entry. See src/content-components/Card/ for
// the implementation.
// ---------------------------------------------------------------------------

/** Container style. "filled" = bg + border (default); "outlined" = border
 *  only; "bare" = no chrome. */
export const CARD_VARIANTS = ["filled", "outlined", "bare"] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const CARD_VARIANT_LABELS: Record<CardVariant, string> = {
  filled: "Filled (bg + border)",
  outlined: "Outlined (border only)",
  bare: "Bare (no chrome)",
};

/** How media sits relative to body. "vertical" = media above (default);
 *  "horizontal" = media beside body. Horizontal stacks to vertical on narrow
 *  screens. */
export const CARD_ORIENTATIONS = ["vertical", "horizontal"] as const;
export type CardOrientation = (typeof CARD_ORIENTATIONS)[number];

export const CARD_ORIENTATION_LABELS: Record<CardOrientation, string> = {
  vertical: "Vertical (media above)",
  horizontal: "Horizontal (media beside)",
};

/** Size controls padding + type scale. */
export const CARD_SIZES = ["sm", "md", "lg"] as const;
export type CardSize = (typeof CARD_SIZES)[number];

export const CARD_SIZE_LABELS: Record<CardSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

/** Media aspect ratio. `auto` lets the media keep its intrinsic aspect
 *  (used when there's no media, or for native `<audio>` / horizontal lists). */
export const CARD_MEDIA_ASPECTS = ["4:3", "1:1", "16:9", "auto"] as const;
export type CardMediaAspect = (typeof CARD_MEDIA_ASPECTS)[number];

export const CARD_MEDIA_ASPECT_LABELS: Record<CardMediaAspect, string> = {
  "4:3": "4:3 (photo, general)",
  "1:1": "1:1 (album art, square)",
  "16:9": "16:9 (video, widescreen)",
  auto: "Auto",
};

/** Kind of media the card renders. `auto` = infer from `media` / `file`
 *  extension (recommended default; authors usually don't set this). */
export const CARD_MEDIA_KINDS = [
  "auto",
  "photo",
  "audio",
  "video",
  "pdf",
  "icon",
  "none",
] as const;
export type CardMediaKind = (typeof CARD_MEDIA_KINDS)[number];

export const CARD_MEDIA_KIND_LABELS: Record<CardMediaKind, string> = {
  auto: "Auto (infer from file extension)",
  photo: "Photo (thumbnail)",
  audio: "Audio (inline player)",
  video: "Video (inline player)",
  pdf: "PDF icon",
  icon: "Generic file icon",
  none: "None (no media)",
};

// ---------------------------------------------------------------------------
// Center-alignment primitives
//
// Three independent enums that together cover the common "center this" needs:
//
//   - BLOCKQUOTE_VARIANTS       — `{% blockquote %}` tag variants. "featured"
//                                 is centered + larger; "normal" inherits the
//                                 default flow-text blockquote style.
//   - CENTERED_BLOCK_MAX_WIDTHS — `{% centered-block %}` tag width presets.
//   - TEXT_ALIGNMENTS           — `textAlign` attribute shared by `section`,
//                                 `fullscreen-section`, and `column` wrappers.
// ---------------------------------------------------------------------------

/** Visual variant for `{% blockquote %}`. */
export const BLOCKQUOTE_VARIANTS = ["normal", "featured"] as const;
export type BlockquoteVariant = (typeof BLOCKQUOTE_VARIANTS)[number];

export const BLOCKQUOTE_VARIANT_LABELS: Record<BlockquoteVariant, string> = {
  normal: "Normal",
  featured: "Featured (centered, large)",
};

/** Max-width preset for `{% centered-block %}`. */
export const CENTERED_BLOCK_MAX_WIDTHS = ["narrow", "regular"] as const;
export type CenteredBlockMaxWidth = (typeof CENTERED_BLOCK_MAX_WIDTHS)[number];

export const CENTERED_BLOCK_MAX_WIDTH_LABELS: Record<CenteredBlockMaxWidth, string> = {
  narrow: "Narrow (~60ch)",
  regular: "Regular (max-text)",
};

/**
 * Horizontal text alignment for wrapper tags (`section`, `fullscreen-section`,
 * `column`). `start` is the default — no-op at render time — and preserves
 * existing output.
 */
export const TEXT_ALIGNMENTS = ["start", "center", "end"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

export const TEXT_ALIGNMENT_LABELS: Record<TextAlignment, string> = {
  start: "Start (default)",
  center: "Center",
  end: "End",
};
