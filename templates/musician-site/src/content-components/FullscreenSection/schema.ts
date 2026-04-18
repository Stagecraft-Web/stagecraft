import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { FullscreenSectionPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/FullscreenSection/FullscreenSection.astro",
  attributes: {
    title: { type: String },
    headingLevel: { type: String, default: "h2" },
    isTitleHidden: { type: Boolean, default: false },
    image: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Fullscreen Section",
  description:
    "A full-viewport section with a background image. Content appears on top of the image.",
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
    image: fields.image({
      label: "Background Image",
      directory: "src/assets/images",
      publicPath: "../../assets/images/",
    }),
  },
  ContentView: FullscreenSectionPreview,
});

export const tagName = "fullscreen-section";
