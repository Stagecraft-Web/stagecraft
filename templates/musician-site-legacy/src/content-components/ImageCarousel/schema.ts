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
 * Sentinel value for the "show every photo" option. Combined with
 * IMAGE_USAGE_SLOTS to form the full set of legal `photosCollection` values
 * accepted by both the markdoc schema and the Keystatic select. Using a
 * named sentinel (rather than the empty string) lets markdoc's `matches`
 * validate the attribute without a special case. Same pattern as
 * PostsList's `category` filter.
 */
const PHOTOS_FILTER_OPTIONS = ["all", ...IMAGE_USAGE_SLOTS] as const;
type PhotosFilter = (typeof PHOTOS_FILTER_OPTIONS)[number];
export type { PhotosFilter };

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
      default: "all",
      // `"all"` shows every photo; the other values match against the
      // `usageSlot` field on each photo entry. (The attribute name is
      // `photosCollection` per the spec; names kept as-is.)
      matches: [...PHOTOS_FILTER_OPTIONS],
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
      options: PHOTOS_FILTER_OPTIONS.map((v) => ({
        label: v === "all" ? "All photos" : IMAGE_USAGE_SLOT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: PhotosFilter },
        ...{ label: string; value: PhotosFilter }[],
      ],
      defaultValue: "all",
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

export const tagName = "image-carousel";
