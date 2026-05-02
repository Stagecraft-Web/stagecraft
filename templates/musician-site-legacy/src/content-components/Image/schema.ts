import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { ImagePreview } from "./preview";

/**
 * Markdoc tag `content-image`. The folder and file are named `Image` to match
 * the admin-facing label and our internal conventions, but the markdoc slug
 * stays `content-image` to avoid colliding with `astro:assets`'s `Image`.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Image/Image.astro",
  selfClosing: true,
  attributes: {
    src: { type: String, required: true },
    alt: { type: String, required: true },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Image",
  description:
    "An optimized image. Use inside columns or anywhere in page content.",
  schema: {
    src: fields.image({
      label: "Image",
      directory: "src/assets/images",
      publicPath: "../../assets/images/",
      validation: { isRequired: true },
    }),
    alt: fields.text({ label: "Alt Text", validation: { isRequired: true } }),
  },
  ContentView: ImagePreview,
});

export const tagName = "content-image";
