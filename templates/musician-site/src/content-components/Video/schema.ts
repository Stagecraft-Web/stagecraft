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
 * paste a URL directly in-place (with type + optional title).
 *
 * Both Markdoc and Keystatic schemas use the same flat shape: `slug`, `url`,
 * `type`, `title`, `caption`. Keystatic's `block()` content-component API has
 * no parse/serialize hook to bridge a `fields.conditional` to flat Markdoc
 * tag attributes, so a conditional in the Keystatic schema would fail to load
 * existing tags ("Key on object value 'slug' is not allowed"). The (slug XOR
 * url) constraint is enforced at render time in Video.astro instead.
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
    "A single video, embedded inline. Either pick a video from the Videos " +
    "collection by filling in 'Video slug', or paste a YouTube / Vimeo URL " +
    "with 'Video URL' + 'Type'. Don't fill both — the renderer enforces a " +
    "slug-or-url choice and will error if both are set.",
  schema: {
    slug: fields.text({
      label: "Video slug (collection mode)",
      description:
        "Filename (without .yaml) of an entry in src/content/collections/videos " +
        "— e.g. 'live-session' for live-session.yaml. Leave blank if using a direct URL.",
    }),
    url: fields.text({
      label: "Video URL (URL mode)",
      description:
        "Full YouTube or Vimeo URL. Leave blank if using a collection slug.",
    }),
    type: fields.select({
      label: "Type (URL mode)",
      description: "Required when 'Video URL' is set. Ignored in collection mode.",
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
      label: "Title (URL mode)",
      description: "Used as the iframe's accessible name. Ignored in collection mode.",
    }),
    caption: fields.text({
      label: "Caption",
      description: "Optional. Rendered as a <figcaption> below the video.",
    }),
  },
  ContentView: VideoPreview,
});

export const tagName = "video";
