import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { PressQuotesPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/PressQuotes/PressQuotes.astro",
  selfClosing: true,
  attributes: {},
};

export const keystatic: KeystaticContentComponent = block({
  label: "Press Quotes",
  description: "Displays all press quotes from the Press Quotes collection.",
  schema: {},
  ContentView: PressQuotesPreview,
});

export const tagName = "press-quotes";
