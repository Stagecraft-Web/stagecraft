import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  TOUR_DATES_FILTERS,
  TOUR_DATES_FILTER_LABELS,
} from "../_shared/types";
import { TourDatesListPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/TourDatesList/TourDatesList.astro",
  selfClosing: true,
  attributes: {
    filter: {
      type: String,
      default: "upcoming",
      matches: TOUR_DATES_FILTERS as unknown as string[],
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Tour Dates List",
  description: "Displays entries from the Tour Dates collection, sorted by date.",
  schema: {
    filter: fields.select({
      label: "Filter",
      description:
        "Upcoming shows only (hides past/canceled), or all shows (e.g. for an archive page).",
      options: TOUR_DATES_FILTERS.map((v) => ({
        label: TOUR_DATES_FILTER_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof TOUR_DATES_FILTERS)[number] },
        ...{ label: string; value: (typeof TOUR_DATES_FILTERS)[number] }[],
      ],
      defaultValue: "upcoming",
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
