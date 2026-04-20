import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import {
  DOWNLOADS_LAYOUTS,
  DOWNLOADS_LAYOUT_LABELS,
  type MarkdocTagDefinition,
  type KeystaticContentComponent,
} from "../_shared/types";
import { DownloadsPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Downloads/Downloads.astro",
  attributes: {
    title: { type: String },
    layout: { type: String, default: "list", matches: [...DOWNLOADS_LAYOUTS] },
  },
};

/**
 * `wrapper()` — Keystatic doesn't expose a per-wrapper child allowlist, so
 * "only allows Download children" is a convention rather than a hard constraint.
 * Authors are guided by this wrapper's description and by the fact that the
 * `{% download %}` block is the obviously-matching child tag. Downloads.astro
 * renders whatever's in the slot, so non-Download children would render but
 * look out of place.
 */
export const keystatic: KeystaticContentComponent = wrapper({
  label: "Downloads",
  description:
    "Grouped list/grid of Download blocks with an optional section title and a shared layout. Use when you want a press-kit-style batch. Standalone {% download %} blocks also work anywhere in prose — reach for this wrapper only when grouping or layout control matters.",
  schema: {
    title: fields.text({
      label: "Section title (optional)",
      description: "Heading rendered above the list. Leave blank to omit.",
    }),
    layout: fields.select({
      label: "Layout",
      description:
        "List stacks items vertically with previews alongside. Grid lays items out as cards.",
      options: DOWNLOADS_LAYOUTS.map((value) => ({
        label: DOWNLOADS_LAYOUT_LABELS[value],
        value,
      })),
      defaultValue: "list",
    }),
  },
  ContentView: DownloadsPreview,
});

export const tagName = "downloads";
