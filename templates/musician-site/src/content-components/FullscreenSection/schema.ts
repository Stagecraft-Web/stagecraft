import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  HeadingLevel,
} from "../_shared/types";
import { FullscreenSectionPreview } from "./preview";

const HEADING_LEVELS: readonly HeadingLevel[] = ["h1", "h2", "h3", "h4"];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/FullscreenSection/FullscreenSection.astro",
  attributes: {
    title: { type: String },
    headingLevel: { type: String, default: "h2", matches: [...HEADING_LEVELS] },
    isTitleHidden: { type: Boolean, default: false },
    image: { type: String },
    /**
     * Optional background video (mp4 or webm). When set, the video is rendered
     * as the section background with `image` acting as the poster + fallback.
     * Renderer hides the video for users with `prefers-reduced-motion: reduce`.
     */
    video: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Fullscreen Section",
  description:
    "A full-viewport section with a background image (and optional looping video). Content appears on top of the background.",
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
    video: fields.file({
      label: "Background Video (optional, mp4 or webm)",
      description:
        "Loops silently behind the content. The background image above is required as a poster and a fallback for browsers or users that block autoplay (including 'reduce motion' preferences).",
      directory: "src/assets/videos",
      publicPath: "../../assets/videos/",
    }),
  },
  ContentView: FullscreenSectionPreview,
});

export const tagName = "fullscreen-section";
