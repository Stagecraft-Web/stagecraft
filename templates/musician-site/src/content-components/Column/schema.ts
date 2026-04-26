import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { TEXT_ALIGNMENTS, TEXT_ALIGNMENT_LABELS } from "../_shared/types";
import { ColumnPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Column/Column.astro",
  attributes: {
    textAlign: {
      type: String,
      default: "start",
      matches: TEXT_ALIGNMENTS as unknown as string[],
    },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Column",
  description: "A single column within a Columns layout.",
  schema: {
    textAlign: fields.select({
      label: "Text Alignment",
      description:
        "Horizontal alignment for text inside this column. Default is Start (inherits the page direction).",
      options: TEXT_ALIGNMENTS.map((v) => ({
        label: TEXT_ALIGNMENT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof TEXT_ALIGNMENTS)[number] },
        ...{ label: string; value: (typeof TEXT_ALIGNMENTS)[number] }[],
      ],
      defaultValue: "start",
    }),
  },
  ContentView: ColumnPreview,
});

export const tagName = "column";
