import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { ReleaseListPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/ReleaseList/ReleaseList.astro",
  selfClosing: true,
  attributes: {},
};

export const keystatic: KeystaticContentComponent = block({
  label: "Release List",
  description: "Displays all music releases in a grid.",
  schema: {},
  ContentView: ReleaseListPreview,
});

export const tagName = "release-list";
