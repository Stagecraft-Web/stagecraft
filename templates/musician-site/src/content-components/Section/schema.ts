import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { HEADING_LEVELS, HEADING_LEVEL_LABELS } from "../_shared/types";

/** Markdoc tag: `{% section %}` — wraps children in a titled section. */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Section/Section.astro",
  attributes: {
    title: { type: String },
    headingLevel: {
      type: String,
      default: "h2",
      matches: HEADING_LEVELS as unknown as string[],
    },
    isTitleHidden: { type: Boolean, default: false },
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
  },
});

/** Markdoc tag name (slug) — distinct from the component folder/file name. */
export const tagName = "section";
