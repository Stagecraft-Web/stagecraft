import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  EMBED_ASPECT_RATIOS,
  EMBED_ASPECT_RATIO_LABELS,
  type EmbedAspectRatio,
} from "../_shared/types";
import { EmbedResponsivePreview } from "./preview";

/**
 * Markdoc tag `embed-responsive`.
 *
 * Same parser + sanitization as `embed`, plus an aspect-ratio wrapper that
 * scales the iframe to fill its column. Use this for video embeds, or for
 * fixed-pixel music players that look better filling the column than sitting
 * left-aligned at native size.
 *
 * Naming: kept under the `EmbedResponsive/` directory so it sorts adjacent
 * to `Embed/` in the source tree, and the markdoc tag (`embed-responsive`)
 * sorts adjacent to `embed` in the generated schema. Keystatic's insert
 * menu also lists "Embed" and "Embed (responsive)" together.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/EmbedResponsive/EmbedResponsive.astro",
  selfClosing: true,
  attributes: {
    code: { type: String, required: true },
    aspectRatio: {
      type: String,
      default: "auto",
      matches: [...EMBED_ASPECT_RATIOS],
    },
    title: { type: String },
    maxWidth: { type: Number },
    minHeight: { type: Number },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Embed (responsive)",
  description:
    "Embed a player that scales to fill its column. 'Auto' aspect derives the ratio from the iframe's intrinsic dimensions (best for fixed-size players like Bandcamp). Pick an explicit ratio for video embeds.",
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
        "'Auto' uses the iframe's intrinsic dimensions. Pick an explicit ratio for video embeds so they scale at a consistent shape.",
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
    maxWidth: fields.integer({
      label: "Max width (px)",
      description:
        "Optional cap on the wrapper's width. Useful when the source player looks awkward stretched across a wide column.",
    }),
    minHeight: fields.integer({
      label: "Min height (px)",
      description:
        "Optional floor on the wrapper's height. Useful for short players that would otherwise collapse on very narrow columns.",
    }),
  },
  ContentView: EmbedResponsivePreview,
});

export const tagName = "embed-responsive";
