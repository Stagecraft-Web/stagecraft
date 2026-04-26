import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  EMBED_ASPECT_RATIOS,
  EMBED_ASPECT_RATIO_LABELS,
} from "../_shared/types";
import { EmbedPreview } from "./preview";

/**
 * Markdoc tag `embed`.
 *
 * Single-segment slug — chosen deliberately to dodge the upstream markdoc
 * 3-segment-kebab-case bug. Anything `embed-foo-bar` would risk hitting it.
 *
 * Why a generic `embed` rather than per-service tags
 * --------------------------------------------------
 * Earlier iterations (PR #30) discriminated on `service` and accepted a
 * service-specific id (Spotify URI, Bandcamp album id, etc.). That hit
 * three problems for a single-artist site:
 *
 *   1. Every new service required a code change.
 *   2. Authors already paste raw embed code from each service's "Share"
 *      UI — translating to / from a service+id was a friction step.
 *   3. Video services (YouTube, Vimeo) belong with a separate Video
 *      content-component, not lumped into a music-embed block.
 *
 * Trusting the author's snippet is acceptable here (single-author site),
 * but we still parse + sanitize it (see ./extractIframe.ts) so the page
 * doesn't ship arbitrary HTML, just the iframe with an attribute allowlist.
 */

/**
 * Re-export from `_shared/types` so existing imports from `./schema`
 * (e.g. Embed.astro) keep working without knowing the canonical location.
 */
export type EmbedAspectRatio = (typeof EMBED_ASPECT_RATIOS)[number];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Embed/Embed.astro",
  selfClosing: true,
  attributes: {
    code: { type: String, required: true },
    title: { type: String },
    responsive: { type: Boolean, default: true },
    aspectRatio: {
      type: String,
      default: "auto",
      matches: [...EMBED_ASPECT_RATIOS],
    },
    minHeight: { type: Number },
    maxWidth: { type: Number },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Embed",
  description:
    "Embed a player from any service. Paste the raw HTML from the service's 'Share / Embed' UI (Spotify, Bandcamp, SoundCloud, YouTube, Vimeo, Apple Music, etc.).",
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
    responsive: fields.checkbox({
      label: "Responsive sizing",
      description:
        "On (default): the embed scales to fill the column width while preserving its aspect ratio. Off: the embed renders at the iframe's native pixel size, capped only by the column width.",
      defaultValue: true,
    }),
    aspectRatio: fields.select({
      label: "Aspect ratio (responsive only)",
      description:
        "Used when 'Responsive sizing' is on. 'Auto' derives the ratio from the iframe's intrinsic dimensions; pick a fixed ratio for video embeds. Ignored when sizing is off.",
      options: EMBED_ASPECT_RATIOS.map((v) => ({
        label: EMBED_ASPECT_RATIO_LABELS[v],
        value: v,
      })) as [
        { label: string; value: EmbedAspectRatio },
        ...{ label: string; value: EmbedAspectRatio }[],
      ],
      defaultValue: "auto",
    }),
    minHeight: fields.integer({
      label: "Min height (px, responsive only)",
      description:
        "Floor on the rendered height. Useful for short players that would otherwise collapse on wide columns. Ignored when responsive sizing is off.",
    }),
    maxWidth: fields.integer({
      label: "Max width (px, responsive only)",
      description:
        "Ceiling on the rendered width. By default a responsive embed fills its column with no cap; set this to keep a small player from stretching past a comfortable size on wide layouts.",
    }),
  },
  ContentView: EmbedPreview,
});

export const tagName = "embed";
