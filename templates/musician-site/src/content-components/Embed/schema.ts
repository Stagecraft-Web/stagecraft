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
    aspectRatio: {
      type: String,
      default: "auto",
      matches: [...EMBED_ASPECT_RATIOS],
    },
    title: { type: String },
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
    aspectRatio: fields.select({
      label: "Aspect ratio",
      description:
        "'Auto' uses the iframe's intrinsic dimensions (best for fixed-height players like Spotify). Pick a ratio for video embeds so they scale responsively.",
      options: EMBED_ASPECT_RATIOS.map((v) => ({
        label: EMBED_ASPECT_RATIO_LABELS[v],
        value: v,
      })) as [
        { label: string; value: EmbedAspectRatio },
        ...{ label: string; value: EmbedAspectRatio }[],
      ],
      defaultValue: "auto",
    }),
    title: fields.text({
      label: "Accessible title (optional)",
      description:
        "A short label describing the embedded content for screen readers. Falls back to the iframe's own title or a generic label.",
    }),
    minHeight: fields.integer({
      label: "Min height (px)",
      description:
        "Optional minimum height for the embed wrapper. Useful for short players that would otherwise collapse on wide columns.",
    }),
    maxWidth: fields.integer({
      label: "Max width (px)",
      description:
        "Optional cap on the embed's rendered width. Overrides the value auto-detected from the snippet in 'Auto' aspect mode; applies as a plain max-width in other modes.",
    }),
  },
  ContentView: EmbedPreview,
});

export const tagName = "embed";
