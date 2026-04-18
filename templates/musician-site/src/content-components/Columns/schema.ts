import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { ColumnsPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Columns/Columns.astro",
  attributes: {
    layout: { type: String, default: "1-1" },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Columns",
  description:
    "Side-by-side columns that stack on mobile. Place Column components inside.",
  schema: {
    layout: fields.text({
      label: "Layout",
      description:
        "Column proportions separated by dashes, e.g. '1-1' (equal), '1-2' (narrow-wide), '2-1' (wide-narrow), '1-1-1' (three equal).",
      defaultValue: "1-1",
    }),
  },
  ContentView: ColumnsPreview,
});

export const tagName = "columns";
