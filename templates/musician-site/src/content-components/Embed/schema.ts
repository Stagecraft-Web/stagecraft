import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { EmbedPreview } from "./preview";

/**
 * Markdoc tag `embed`.
 *
 * Plain iframe sanitizer-and-render. No aspect-ratio handling, no auto-sizing
 * — the iframe renders at whatever dimensions its source snippet specifies,
 * capped only by `max-width: 100%` so it can't overflow the column.
 *
 * For embeds that should scale to fill the column while preserving an aspect
 * ratio (typical for video, often desired for fixed-pixel music players), use
 * `{% embed-responsive %}` instead — it shares the same parser and adds an
 * aspect-ratio wrapper. The two components are deliberately named to sort
 * adjacently in the source tree (`Embed/`, `EmbedResponsive/`) and in the
 * Keystatic insert menu ("Embed", "Embed (responsive)").
 *
 * Why generic `embed` rather than per-service tags
 * ------------------------------------------------
 * Earlier iterations (PR #30) discriminated on `service` and accepted a
 * service-specific id. That hit three problems for a single-artist site:
 *
 *   1. Every new service required a code change.
 *   2. Authors already paste raw embed code from each service's "Share" UI
 *      — translating to / from service+id was a friction step.
 *   3. Video services (YouTube, Vimeo) belong with a separate Video
 *      content-component, not lumped into a music-embed block.
 *
 * Trusting the author's snippet is acceptable here (single-author site),
 * but we still parse + sanitize it (see ./extractIframe.ts) so the page
 * doesn't ship arbitrary HTML, just the iframe with an attribute allowlist.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Embed/Embed.astro",
  selfClosing: true,
  attributes: {
    code: { type: String, required: true },
    title: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Embed",
  description:
    "Embed a player at its native size. Paste the raw HTML from the service's 'Share / Embed' UI (Spotify, Bandcamp, SoundCloud, Apple Music, etc.). For embeds that should scale to fill the column, use 'Embed (responsive)' instead.",
  schema: {
    code: fields.text({
      label: "Embed code",
      description:
        "Paste the full <iframe …></iframe> snippet from the service. Only the iframe and a small set of attributes are kept; everything else is stripped on render.",
      multiline: true,
      validation: { isRequired: true },
    }),
    title: fields.text({
      label: "Accessible title (optional)",
      description:
        "A short label describing the embedded content for screen readers. Falls back to the iframe's own title or a generic label.",
    }),
  },
  ContentView: EmbedPreview,
});

export const tagName = "embed";
