import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { VIDEO_URL_TYPES, VIDEO_URL_TYPE_LABELS } from "../_shared/types";
import { VideoPreview } from "./preview";

/**
 * Single-video block. Mirrors the Image / PhotoGallery split: PhotoGallery
 * renders the whole `videos` collection, Video renders one inline.
 *
 * The video can come from either the `videos` collection (the author picks a
 * slug and the renderer looks up title/url/type/description) OR the author can
 * paste a URL directly in-place (with type + optional title). The two modes
 * are surfaced as a Keystatic `fields.conditional` discriminated by `source`.
 *
 * Markdoc tag attributes intentionally diverge from the Keystatic schema —
 * markdoc doesn't model conditionals, so `slug`, `url`, `type`, `title` are
 * all flat-and-optional and Video.astro validates the (slug XOR url) shape at
 * render time. The cross-schema consistency test takes the bridge keys
 * (`source`) from `exemptKeys` so the parity check still passes.
 *
 * NOTE on the VIDEO_URL_TYPES vs VIDEO_TYPES split: the `videos` *collection*
 * (src/lib/schemas.ts) accepts "youtube" | "vimeo" | "other" — "other"
 * renders as a plain link. The inline Video *block* can only emit an iframe,
 * so it restricts to the two embeddable platforms. The constant lives in
 * `_shared/types.ts` to keep the two clearly separate.
 */

type VideoUrlType = (typeof VIDEO_URL_TYPES)[number];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Video/Video.astro",
  selfClosing: true,
  attributes: {
    // Collection mode: slug of an entry in the `videos` collection.
    slug: { type: String },
    // URL mode: direct URL + type. `url` is required when `slug` is absent;
    // `type` is required when `url` is set. Validated at render time because
    // markdoc attribute schemas can't express this conditional requirement.
    url: { type: String },
    type: {
      type: String,
      matches: [...VIDEO_URL_TYPES],
    },
    title: { type: String },
    // Optional in both modes — rendered as <figcaption> below the iframe.
    caption: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Video",
  description:
    "A single video, embedded inline. Pick a video from the Videos collection " +
    "or paste a YouTube / Vimeo URL directly.",
  schema: {
    source: fields.conditional(
      fields.select({
        label: "Source",
        description:
          "Pull from the Videos collection (re-use a video listed elsewhere) " +
          "or paste a URL just for this spot.",
        options: [
          { label: "Videos collection", value: "collection" },
          { label: "Direct URL", value: "url" },
        ],
        defaultValue: "collection",
      }),
      {
        collection: fields.object(
          {
            slug: fields.text({
              label: "Video slug",
              description:
                "Filename (without .yaml) of an entry in src/content/collections/videos. " +
                "E.g. 'live-session' for live-session.yaml.",
              validation: { length: { min: 1 } },
            }),
          },
          { label: "Collection entry" },
        ),
        url: fields.object(
          {
            url: fields.url({
              label: "Video URL",
              description: "Full YouTube or Vimeo URL.",
              validation: { isRequired: true },
            }),
            type: fields.select({
              label: "Type",
              options: VIDEO_URL_TYPES.map((v) => ({
                label: VIDEO_URL_TYPE_LABELS[v],
                value: v,
              })) as [
                { label: string; value: VideoUrlType },
                ...{ label: string; value: VideoUrlType }[],
              ],
              defaultValue: "youtube" satisfies VideoUrlType,
            }),
            title: fields.text({
              label: "Title",
              description: "Used as the iframe accessible name.",
            }),
          },
          { label: "Direct URL" },
        ),
      },
    ),
    caption: fields.text({
      label: "Caption",
      description: "Optional. Rendered as a <figcaption> below the video.",
    }),
  },
  ContentView: VideoPreview,
});

export const tagName = "video";

/**
 * The cross-schema consistency test compares the *top-level* keys of each
 * schema. Markdoc lists the inline attributes flat (`slug`, `url`, `type`,
 * `title`); Keystatic groups them under a `source` conditional. Tell the test
 * to skip those keys so it still validates the rest (`caption`).
 */
export const exemptKeys = ["slug", "url", "type", "title", "source"];
