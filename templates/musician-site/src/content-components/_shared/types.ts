/**
 * Shared schema types for content-components.
 *
 * Each component's schema.ts exports a `markdoc` shape (consumed by
 * markdoc.config.ts) and a `keystatic` shape (consumed by keystatic.config.ts).
 * Those two configs never consume these types directly — they accept whatever
 * @astrojs/markdoc and @keystatic/core expect — but keeping a thin shared type
 * here documents the contract and guards against typos across components.
 */
import type { ContentComponent } from "@keystatic/core/content-components";

/**
 * The shape of a markdoc tag definition, matching @astrojs/markdoc's
 * `defineMarkdocConfig` tags entries. We keep `render` as a string path
 * here — markdoc.config.ts wraps it with `component(...)` when assembling
 * the final config.
 */
export type MarkdocTagDefinition = {
  render: string;
  selfClosing?: boolean;
  attributes: Record<
    string,
    {
      type: StringConstructor | NumberConstructor | BooleanConstructor;
      required?: boolean;
      default?: string | number | boolean;
    }
  >;
};

/**
 * A Keystatic content-component (either block or wrapper). The core library
 * exports a union `ContentComponent` that covers both — we re-export under
 * a clearer name so component files read as `KeystaticContentComponent`.
 */
export type KeystaticContentComponent = ContentComponent;
