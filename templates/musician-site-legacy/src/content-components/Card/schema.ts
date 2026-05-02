import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import {
  CARD_MEDIA_ASPECTS,
  CARD_MEDIA_ASPECT_LABELS,
  CARD_MEDIA_KINDS,
  CARD_MEDIA_KIND_LABELS,
  CARD_ORIENTATIONS,
  CARD_ORIENTATION_LABELS,
  CARD_SIZES,
  CARD_SIZE_LABELS,
  CARD_VARIANTS,
  CARD_VARIANT_LABELS,
  type MarkdocTagDefinition,
  type KeystaticContentComponent,
} from "../_shared/types";
import { CardPreview } from "./preview";

// Card is a wrapper so authors can put any markdoc body content inside — this
// is how ReleaseCard-style descriptions, download-card captions, and post-card
// excerpts all compose from the same component. Self-closing use also works
// (`{% card title=... /%}`): markdoc accepts both forms for wrapper tags with
// all-optional body.
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Card/Card.astro",
  attributes: {
    // Container
    variant: { type: String, matches: [...CARD_VARIANTS] },
    orientation: { type: String, matches: [...CARD_ORIENTATIONS] },
    size: { type: String, matches: [...CARD_SIZES] },
    hover: { type: Boolean },

    // Whole-card link
    href: { type: String },
    isExternal: { type: Boolean },

    // Media
    media: { type: String },
    mediaKind: { type: String, matches: [...CARD_MEDIA_KINDS] },
    mediaAspect: { type: String, matches: [...CARD_MEDIA_ASPECTS] },
    mediaAlt: { type: String },

    // Built-in metadata
    eyebrow: { type: String },
    title: { type: String },
    meta: { type: String },

    // Download affordance
    file: { type: String },
    sizeLabel: { type: String },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Card",
  description:
    "A flexible tile for downloads, release summaries, post previews, or any media-plus-text block. Media kind is inferred from the file extension by default.",
  schema: {
    // --- The most commonly-used fields first ---
    title: fields.text({
      label: "Title",
      description:
        "Primary text. Rendered as a styled line, not a heading element, so grids of cards don't pollute the page outline.",
    }),

    media: fields.file({
      label: "Media file (optional)",
      description:
        "Image, audio, video, or PDF to show as the card's preview. When `File` is set and this is empty, the download file doubles as the preview.",
      directory: "src/assets/downloads",
      publicPath: "../../../assets/downloads/",
    }),

    mediaAlt: fields.text({
      label: "Media alt text (if media is a photo)",
      description:
        "Descriptive alt for screen readers. Required when the preview is a photo; leave blank for audio / video / pdf / icon previews.",
    }),

    file: fields.file({
      label: "Downloadable file (optional)",
      description:
        "When set, adds a 'Download' button in the footer. Can be the same file as `Media`, or a different one (e.g. a high-res original for download with a low-res preview).",
      directory: "src/assets/downloads",
      publicPath: "../../../assets/downloads/",
    }),

    sizeLabel: fields.text({
      label: "Size / meta label (optional)",
      description:
        "Free-text label beside the download button — '1024 × 1536', '2.3 MB', '2 pages, 180 KB'.",
    }),

    // --- Secondary metadata ---
    eyebrow: fields.text({
      label: "Eyebrow (optional)",
      description: "Small uppercase label above the title (e.g. a category).",
    }),

    meta: fields.text({
      label: "Meta line (optional)",
      description:
        "Small secondary line below the title — date, release type, etc.",
    }),

    href: fields.text({
      label: "Link URL (optional)",
      description:
        "If set, the whole card becomes a link. Use for post-cards, release-detail links, etc. Cards with a download `File` should leave this blank — the download button handles the interaction.",
    }),

    isExternal: fields.checkbox({
      label: "Open link in new tab",
      defaultValue: false,
    }),

    // --- Variant + layout controls ---
    variant: fields.select({
      label: "Variant",
      options: CARD_VARIANTS.map((value) => ({
        label: CARD_VARIANT_LABELS[value],
        value,
      })),
      defaultValue: "filled",
    }),

    orientation: fields.select({
      label: "Orientation",
      options: CARD_ORIENTATIONS.map((value) => ({
        label: CARD_ORIENTATION_LABELS[value],
        value,
      })),
      defaultValue: "vertical",
    }),

    size: fields.select({
      label: "Size",
      options: CARD_SIZES.map((value) => ({
        label: CARD_SIZE_LABELS[value],
        value,
      })),
      defaultValue: "md",
    }),

    hover: fields.checkbox({
      label: "Hover lift",
      description:
        "Adds a subtle lift-on-hover effect. Natural pairing with a link URL.",
      defaultValue: false,
    }),

    // --- Advanced overrides ---
    mediaKind: fields.select({
      label: "Media kind override",
      description:
        "Leave as 'Auto' in 95% of cases — the file extension tells us. Override only when auto-inference gets it wrong (e.g. an `.mov` you want rendered as an icon, or a download tile with no preview at all).",
      options: CARD_MEDIA_KINDS.map((value) => ({
        label: CARD_MEDIA_KIND_LABELS[value],
        value,
      })),
      defaultValue: "auto",
    }),

    mediaAspect: fields.select({
      label: "Media aspect ratio",
      description:
        "Default '4:3' gives every card the same media height so titles align across a grid. Use '1:1' for square album art, '16:9' for widescreen.",
      options: CARD_MEDIA_ASPECTS.map((value) => ({
        label: CARD_MEDIA_ASPECT_LABELS[value],
        value,
      })),
      defaultValue: "4:3",
    }),
  },
  ContentView: CardPreview,
});

export const tagName = "card";
