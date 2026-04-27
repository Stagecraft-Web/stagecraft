import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { TourDatesListPreview } from "./preview";

const DEFAULT_EMPTY_MESSAGE = "No upcoming shows. Check back soon.";
const DEFAULT_PAGE_SIZE = 10;

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/TourDatesList/TourDatesList.astro",
  selfClosing: true,
  attributes: {
    emptyMessage: {
      type: String,
      default: DEFAULT_EMPTY_MESSAGE,
    },
    pageSize: {
      type: Number,
      default: DEFAULT_PAGE_SIZE,
    },
    categoryFilter: {
      type: String,
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Tour Dates List",
  description:
    "Lists entries from the Tour Dates collection. Auto-groups into upcoming (ascending) and past (descending); when few upcoming shows remain, pads with recent past shows under a 'Recent shows' subheading.",
  schema: {
    emptyMessage: fields.text({
      label: "Empty state message",
      description: "Shown when there are no upcoming shows.",
      defaultValue: DEFAULT_EMPTY_MESSAGE,
    }),
    pageSize: fields.integer({
      label: "Page size",
      description:
        "How many shows to display before the 'Show more' button. Revealed in batches of this size.",
      defaultValue: DEFAULT_PAGE_SIZE,
      validation: { min: 1 },
    }),
    categoryFilter: fields.relationship({
      label: "Category filter",
      collection: "tourCategories",
      description:
        "Optional — only include tour dates linked to this category. Leave blank to show all.",
    }),
  },
  ContentView: TourDatesListPreview,
});

// Tag name uses two segments (no 3-segment kebab) because @astrojs/markdoc's
// internal `toImportName` helper only replaces the first dash in a tag name
// when generating a JS identifier. A three-segment name like
// "tour-dates-list" produces an invalid identifier (`tour_dates-list`) and
// breaks the build. Keeping this at `tour-dates` mirrors the release-list /
// photo-gallery naming cadence and stays in the adapter's safe zone.
export const tagName = "tour-dates";
