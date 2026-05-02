import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { PhotoGalleryPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/PhotoGallery/PhotoGallery.astro",
  selfClosing: true,
  attributes: {},
};

export const keystatic: KeystaticContentComponent = block({
  label: "Photo Gallery",
  description: "Displays all photos from the Photos collection with lightbox.",
  schema: {},
  ContentView: PhotoGalleryPreview,
});

export const tagName = "photo-gallery";
