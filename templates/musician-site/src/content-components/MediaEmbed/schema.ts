import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { MEDIA_EMBED_SERVICES } from "./toEmbedUrl";
import { MediaEmbedPreview } from "./preview";

/**
 * `media-embed` is a single block with a `service` discriminator rather than
 * one block per service. That keeps the editor's "insert" menu compact (one
 * "Media Embed" entry) while still constraining the choice to a known set of
 * services that the renderer knows how to embed.
 *
 * Tag name is `media-embed` (2-segment kebab) to stay safe from the
 * @astrojs/markdoc 3-segment-kebab bug documented in PR #28's TourDatesList.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/MediaEmbed/MediaEmbed.astro",
  selfClosing: true,
  attributes: {
    service: {
      type: String,
      required: true,
      matches: [...MEDIA_EMBED_SERVICES],
    },
    // `id` is intentionally permissive: the renderer accepts either a raw
    // service-specific ID or a full URL and extracts the canonical ID.
    id: { type: String, required: true },
    title: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Media Embed",
  description:
    "Embed a single external media player (Spotify album, Bandcamp album, " +
    "YouTube video, or Vimeo video) inline in the page.",
  schema: {
    service: fields.select({
      label: "Service",
      description: "Which media service to embed.",
      options: [
        { label: "Spotify Album", value: "spotify-album" },
        { label: "Bandcamp Album", value: "bandcamp-album" },
        { label: "YouTube Video", value: "youtube-video" },
        { label: "Vimeo Video", value: "vimeo-video" },
      ],
      defaultValue: "spotify-album",
    }),
    id: fields.text({
      label: "ID or URL",
      description:
        "Paste either the full URL (e.g. https://open.spotify.com/album/...) " +
        "or just the service-specific ID. Bandcamp requires the numeric album " +
        'ID from the "Share / Embed this album" dialog.',
      validation: { isRequired: true },
    }),
    title: fields.text({
      label: "Title (optional)",
      description:
        "Accessible label for the iframe. Defaults to a generic " +
        '"<Service> embed" label when omitted.',
    }),
  },
  ContentView: MediaEmbedPreview,
});

export const tagName = "media-embed";
