import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { COLUMNS_LAYOUTS, COLUMNS_LAYOUT_LABELS } from "../_shared/types";
import { ColumnsPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Columns/Columns.astro",
  attributes: {
    layout: {
      type: String,
      default: "1-1",
      matches: [...COLUMNS_LAYOUTS],
    },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Columns",
  description:
    "Side-by-side columns that stack on mobile. Place Column components inside.",
  schema: {
    layout: fields.select({
      label: "Layout",
      description: "Column proportions (each track is an `fr` unit).",
      options: COLUMNS_LAYOUTS.map((v) => ({
        label: COLUMNS_LAYOUT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof COLUMNS_LAYOUTS)[number] },
        ...{ label: string; value: (typeof COLUMNS_LAYOUTS)[number] }[],
      ],
      defaultValue: "1-1",
    }),
  },
  ContentView: ColumnsPreview,
});

export const tagName = "columns";
