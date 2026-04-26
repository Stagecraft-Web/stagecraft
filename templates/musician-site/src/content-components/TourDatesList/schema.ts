import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { TourDatesListPreview } from "./preview";

const DEFAULT_PAST_PADDING = 3;
const DEFAULT_EMPTY_MESSAGE = "No upcoming shows. Check back soon.";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/TourDatesList/TourDatesList.astro",
  selfClosing: true,
  attributes: {
    pastPadding: {
      type: Number,
      default: DEFAULT_PAST_PADDING,
    },
    emptyMessage: {
      type: String,
      default: DEFAULT_EMPTY_MESSAGE,
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Tour Dates List",
  description:
    "Lists entries from the Tour Dates collection. Auto-groups into upcoming (ascending) and past (descending); when few upcoming shows remain, pads with recent past shows under a 'Recent shows' subheading.",
  schema: {
    pastPadding: fields.integer({
      label: "Recent past shows to pad",
      description:
        "Number of past shows to show when there's 0 or 1 upcoming. Ignored when 2+ upcoming shows exist.",
      defaultValue: DEFAULT_PAST_PADDING,
      validation: { min: 0 },
    }),
    emptyMessage: fields.text({
      label: "Empty state message",
      description: "Shown when there are no upcoming shows.",
      defaultValue: DEFAULT_EMPTY_MESSAGE,
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
