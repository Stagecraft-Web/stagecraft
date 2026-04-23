import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  CAROUSEL_ASPECT_RATIOS,
  CAROUSEL_ASPECT_RATIO_LABELS,
  type CarouselAspectRatio,
} from "../_shared/types";
import { IMAGE_USAGE_SLOTS, IMAGE_USAGE_SLOT_LABELS } from "../../lib/schemas";
import { ImageCarouselPreview } from "./preview";

/**
 * Markdoc tag `image-carousel`.
 *
 * Two-segment kebab ("image-carousel") — stays inside the @astrojs/markdoc
 * safe zone. See TourDatesList/schema.ts for the full three-segment-kebab
 * bug description.
 *
 * Collection-filter mode only (inline arrays deferred)
 * ----------------------------------------------------
 * The spec allows either a `photosCollection` (usage-slot filter) or an
 * `inlinePhotos` array. This PR implements collection-filter mode only;
 * inline arrays are tricky in markdoc attributes (arrays-of-objects aren't
 * well-supported) and the proper pattern — a wrapper + child-tag shape
 * like NewsletterSignup — doubles the scope. When inline mode lands it
 * should introduce a second `{% carousel-slide /%}` child tag under an
 * `{% image-carousel %}` wrapper.
 *
 * TODO: add inline-photos mode via a wrapper + `carousel-slide` child tag.
 *
 * Navigation-mechanism validation
 * -------------------------------
 * Authors must leave at least one of (arrows, dots) visible — a carousel
 * with both hidden is a dead-end on touch / screen-reader devices. Markdoc
 * attribute schemas can't express "not both X and Y", so the renderer
 * enforces the constraint at runtime and renders an inline admin preview
 * error when violated.
 */

/**
 * Re-export from `_shared/types` so sibling modules
 * (`ImageCarousel.astro`, `preview.tsx`) can keep importing from
 * `./schema` without knowing the canonical location.
 */
export type { CarouselAspectRatio };

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/ImageCarousel/ImageCarousel.astro",
  selfClosing: true,
  attributes: {
    photosCollection: {
      type: String,
      // Optional — when unset the renderer shows all photos. When set,
      // matches the value against the `usageSlot` field on each photo
      // entry. (The attribute name is `photosCollection` per the spec but
      // the value is an IMAGE_USAGE_SLOTS member; names kept as-is to
      // match the specification verbatim.)
      matches: IMAGE_USAGE_SLOTS as unknown as string[],
    },
    aspectRatio: {
      type: String,
      default: "16/9",
      matches: CAROUSEL_ASPECT_RATIOS as unknown as string[],
    },
    areArrowsHidden: {
      type: Boolean,
      default: false,
    },
    areDotsHidden: {
      type: Boolean,
      default: false,
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Image Carousel",
  description:
    "Rotating image carousel driven by the Photos collection. Filter by usage slot to pick which photos appear. No autoplay; visitors control slide changes via arrows, dots, or keyboard.",
  schema: {
    photosCollection: fields.select({
      label: "Photo usage slot",
      description:
        "Filter the Photos collection to photos with this usage slot. 'All photos' shows every entry. (Inline-photos mode is not yet supported; add matching photos to the Photos collection.)",
      options: [
        { label: "All photos", value: "" },
        ...IMAGE_USAGE_SLOTS.map((v) => ({
          label: IMAGE_USAGE_SLOT_LABELS[v],
          value: v,
        })),
      ] as [
        { label: string; value: string },
        ...{ label: string; value: string }[],
      ],
      defaultValue: "",
    }),
    aspectRatio: fields.select({
      label: "Aspect ratio",
      description:
        "Shape of the carousel frame. 'Auto' lets each image keep its intrinsic aspect — best for mixed portrait/landscape sets.",
      options: CAROUSEL_ASPECT_RATIOS.map((v) => ({
        label: CAROUSEL_ASPECT_RATIO_LABELS[v],
        value: v,
      })) as [
        { label: string; value: CarouselAspectRatio },
        ...{ label: string; value: CarouselAspectRatio }[],
      ],
      defaultValue: "16/9",
    }),
    areArrowsHidden: fields.checkbox({
      label: "Hide arrow buttons",
      description:
        "Hides the prev/next arrow controls. Leave at least one navigation mechanism (arrows or dots) visible.",
      defaultValue: false,
    }),
    areDotsHidden: fields.checkbox({
      label: "Hide dot indicators",
      description:
        "Hides the dot indicator row. Leave at least one navigation mechanism (arrows or dots) visible.",
      defaultValue: false,
    }),
  },
  ContentView: ImageCarouselPreview,
});

// The empty-string "All photos" option is a preview/admin-only value —
// the astro renderer treats an empty `photosCollection` attribute as
// "show all". Markdoc's `matches` constraint would otherwise reject it,
// so we mark this as exempt from the schema-consistency test's
// select-options-match-matches check.
export const exemptKeys = ["photosCollection"];

export const tagName = "image-carousel";
