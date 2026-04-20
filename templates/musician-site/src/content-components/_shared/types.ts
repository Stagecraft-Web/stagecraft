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
// These literal unions are mirrored by `matches: [...]` arrays in each
// component's markdoc schema and `options: [...]` arrays in its keystatic
// schema. The cross-schema consistency test in
// _shared/schema-consistency.test.ts asserts the two sets stay in sync.
//
// To add a new value: extend the union here, add it to both schemas, then
// run `npm run sync:markdoc-config`.
// ---------------------------------------------------------------------------

/** Heading level for `{% section %}` and `{% fullscreen-section %}` titles. */
export type HeadingLevel = "h1" | "h2" | "h3" | "h4";

/** Visual variant for `{% button %}`. */
export type ButtonVariant = "primary" | "outline";

/** Column-track ratio string for `{% columns %}` (dash-separated `fr` units). */
export type ColumnsLayout = "1-1" | "1-2" | "2-1" | "1-1-1";

/** Filter mode for `{% tour-dates-list %}`. */
export type TourDatesFilter = "upcoming" | "all";

/** Filter mode for `{% store-items %}`. */
export type StoreItemFilter = "all" | "available" | "preorder";

/** Layout mode for `{% store-items %}`. */
export type StoreItemLayout = "grid" | "list";
