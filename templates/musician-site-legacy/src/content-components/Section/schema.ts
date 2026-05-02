import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  HEADING_LEVELS,
  HEADING_LEVEL_LABELS,
  TEXT_ALIGNMENTS,
  TEXT_ALIGNMENT_LABELS,
} from "../_shared/types";

/** Markdoc tag: `{% section %}` — wraps children in a titled section. */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Section/Section.astro",
  attributes: {
    title: { type: String },
    headingLevel: {
      type: String,
      default: "h2",
      matches: [...HEADING_LEVELS],
    },
    isTitleHidden: { type: Boolean, default: false },
    textAlign: {
      type: String,
      default: "start",
      matches: TEXT_ALIGNMENTS as unknown as string[],
    },
  },
};

/** Keystatic editor block for `{% section %}`. No ContentView — label-only. */
export const keystatic: KeystaticContentComponent = wrapper({
  label: "Section",
  description:
    "A content section with optional title. Wraps content in a centered container with vertical padding.",
  schema: {
    title: fields.text({ label: "Title" }),
    headingLevel: fields.select({
      label: "Heading Level",
      options: HEADING_LEVELS.map((v) => ({
        label: HEADING_LEVEL_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof HEADING_LEVELS)[number] },
        ...{ label: string; value: (typeof HEADING_LEVELS)[number] }[],
      ],
      defaultValue: "h2",
    }),
    isTitleHidden: fields.checkbox({
      label: "Hide title visually",
      description: "Title is still read by screen readers for accessibility.",
    }),
    textAlign: fields.select({
      label: "Text Alignment",
      description:
        "Horizontal alignment for text inside this section. Default is Start (inherits the page direction — left-to-right in English).",
      options: TEXT_ALIGNMENTS.map((v) => ({
        label: TEXT_ALIGNMENT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof TEXT_ALIGNMENTS)[number] },
        ...{ label: string; value: (typeof TEXT_ALIGNMENTS)[number] }[],
      ],
      defaultValue: "start",
    }),
  },
});

/** Markdoc tag name (slug) — distinct from the component folder/file name. */
export const tagName = "section";
