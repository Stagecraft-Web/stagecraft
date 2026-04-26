import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { QuotePreview } from "./preview";

/** Markdoc tag: `{% quote text="…" attribution="…" /%}` — featured pull-quote. */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Quote/Quote.astro",
  selfClosing: true,
  attributes: {
    text: { type: String, required: true },
    attribution: { type: String },
  },
};

/** Keystatic editor block for `{% quote %}`. */
export const keystatic: KeystaticContentComponent = block({
  label: "Quote",
  description:
    "A featured pull-quote with optional attribution. Centered, larger type — use for press quotes, testimonials, or pull-quotes.",
  schema: {
    text: fields.text({
      label: "Quote",
      multiline: true,
      validation: { isRequired: true },
    }),
    attribution: fields.text({
      label: "Attribution",
      description: "Source of the quote (e.g. publication, person). Rendered below the quote with an em-dash.",
    }),
  },
  ContentView: QuotePreview,
});

export const tagName = "quote";
