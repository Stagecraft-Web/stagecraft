import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  CENTERED_BLOCK_MAX_WIDTHS,
  CENTERED_BLOCK_MAX_WIDTH_LABELS,
} from "../_shared/types";
import { CenteredBlockPreview } from "./preview";

/**
 * Markdoc tag: `{% centered-block %}` — centers its children horizontally
 * with a constrained max-width. Useful for intro paragraphs, CTAs, and other
 * content that reads better as a narrow centered column.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/CenteredBlock/CenteredBlock.astro",
  attributes: {
    maxWidth: {
      type: String,
      default: "narrow",
      matches: CENTERED_BLOCK_MAX_WIDTHS as unknown as string[],
    },
  },
};

/** Keystatic editor block for `{% centered-block %}`. */
export const keystatic: KeystaticContentComponent = wrapper({
  label: "Centered Block",
  description:
    "Centers its children horizontally with a constrained max-width. Pick Narrow for intro paragraphs or CTAs, Regular for longer centered prose.",
  schema: {
    maxWidth: fields.select({
      label: "Max Width",
      options: CENTERED_BLOCK_MAX_WIDTHS.map((v) => ({
        label: CENTERED_BLOCK_MAX_WIDTH_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof CENTERED_BLOCK_MAX_WIDTHS)[number] },
        ...{ label: string; value: (typeof CENTERED_BLOCK_MAX_WIDTHS)[number] }[],
      ],
      defaultValue: "narrow",
    }),
  },
  ContentView: CenteredBlockPreview,
});

/** Markdoc tag name (slug). */
export const tagName = "centered-block";
