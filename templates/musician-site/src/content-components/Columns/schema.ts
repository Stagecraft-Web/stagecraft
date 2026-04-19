import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  ColumnsLayout,
} from "../_shared/types";
import { ColumnsPreview } from "./preview";

const COLUMNS_LAYOUTS: readonly ColumnsLayout[] = ["1-1", "1-2", "2-1", "1-1-1"];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Columns/Columns.astro",
  attributes: {
    layout: { type: String, default: "1-1", matches: [...COLUMNS_LAYOUTS] },
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
      options: [
        { label: "Equal (1:1)", value: "1-1" },
        { label: "Narrow + Wide (1:2)", value: "1-2" },
        { label: "Wide + Narrow (2:1)", value: "2-1" },
        { label: "Three Equal (1:1:1)", value: "1-1-1" },
      ],
      defaultValue: "1-1",
    }),
  },
  ContentView: ColumnsPreview,
});

export const tagName = "columns";
