import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import {
  DOWNLOAD_KINDS,
  DOWNLOAD_KIND_LABELS,
  type MarkdocTagDefinition,
  type KeystaticContentComponent,
} from "../_shared/types";
import { DownloadPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Download/Download.astro",
  selfClosing: true,
  attributes: {
    label: { type: String, required: true },
    file: { type: String, required: true },
    kind: { type: String, default: "other", matches: [...DOWNLOAD_KINDS] },
    description: { type: String },
    credit: { type: String },
    sizeLabel: { type: String },
  },
};

// Both patterns are valid:
//   1. Grouped, inside {% downloads %} wrapper — shared layout + optional title.
//   2. Standalone, anywhere in prose — a single inline download card.
// The description below documents this so Keystatic authors don't assume the
// wrapper is required.
export const keystatic: KeystaticContentComponent = block({
  label: "Download",
  description:
    "A single downloadable file (photo, audio, video, PDF, or other). Works standalone anywhere in prose, or inside a Downloads wrapper for grouped layout.",
  schema: {
    label: fields.text({
      label: "Label",
      description: "Shown as the primary line (e.g. 'Press photo (web, 1500px)').",
      validation: { isRequired: true },
    }),
    file: fields.file({
      label: "File",
      description:
        "Upload a file, or provide an external URL by editing the markdoc source (e.g. https://…).",
      directory: "src/assets/downloads",
      publicPath: "../../../assets/downloads/",
      validation: { isRequired: true },
    }),
    kind: fields.select({
      label: "Kind",
      description:
        "Drives the preview shown next to the download button (photo thumbnail, inline audio player, etc.).",
      options: DOWNLOAD_KINDS.map((value) => ({
        label: DOWNLOAD_KIND_LABELS[value],
        value,
      })),
      defaultValue: "other",
    }),
    description: fields.text({
      label: "Description (optional)",
      description: "Secondary line, e.g. 'For digital use — magazines, blogs.'",
      multiline: true,
    }),
    credit: fields.text({
      label: "Credit (optional)",
      description: "E.g. 'Photo by Jane Smith'.",
    }),
    sizeLabel: fields.text({
      label: "Size / meta (optional)",
      description:
        "Free-text size or meta info, e.g. '1024 × 1536', '2.3 MB', '2 pages, 180 KB'.",
    }),
  },
  ContentView: DownloadPreview,
});

export const tagName = "download";
