import { wrapper } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { ColumnPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Column/Column.astro",
  attributes: {},
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Column",
  description: "A single column within a Columns layout.",
  schema: {},
  ContentView: ColumnPreview,
});

export const tagName = "column";
