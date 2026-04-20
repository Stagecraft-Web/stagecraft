import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { VideoGalleryPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/VideoGallery/VideoGallery.astro",
  selfClosing: true,
  attributes: {},
};

export const keystatic: KeystaticContentComponent = block({
  label: "Video Gallery",
  description:
    "Displays all videos from the Videos collection as a thumbnail grid. " +
    "YouTube and Vimeo videos play in an in-page lightbox; other URLs open in a new tab.",
  schema: {},
  ContentView: VideoGalleryPreview,
});

export const tagName = "video-gallery";
