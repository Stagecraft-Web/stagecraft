import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  HeadingLevel,
} from "../_shared/types";

const HEADING_LEVELS: readonly HeadingLevel[] = ["h1", "h2", "h3", "h4"];

/** Markdoc tag: `{% section %}` — wraps children in a titled section. */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Section/Section.astro",
  attributes: {
    title: { type: String },
    headingLevel: { type: String, default: "h2", matches: [...HEADING_LEVELS] },
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
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
        { label: "H4", value: "h4" },
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
