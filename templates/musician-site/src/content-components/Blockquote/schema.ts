import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  BLOCKQUOTE_VARIANTS,
  BLOCKQUOTE_VARIANT_LABELS,
} from "../_shared/types";
import { BlockquotePreview } from "./preview";

/** Markdoc tag: `{% blockquote %}` — wraps authored text in a styled quote. */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Blockquote/Blockquote.astro",
  attributes: {
    variant: {
      type: String,
      default: "normal",
      matches: BLOCKQUOTE_VARIANTS as unknown as string[],
    },
    attribution: { type: String },
  },
};

/** Keystatic editor block for `{% blockquote %}`. */
export const keystatic: KeystaticContentComponent = wrapper({
  label: "Blockquote",
  description:
    "A styled quotation. Featured variant is centered and larger; optional attribution is rendered below when using Featured.",
  schema: {
    variant: fields.select({
      label: "Variant",
      options: BLOCKQUOTE_VARIANTS.map((v) => ({
        label: BLOCKQUOTE_VARIANT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof BLOCKQUOTE_VARIANTS)[number] },
        ...{ label: string; value: (typeof BLOCKQUOTE_VARIANTS)[number] }[],
      ],
      defaultValue: "normal",
    }),
    attribution: fields.text({
      label: "Attribution",
      description:
        "Optional — rendered as a citation line below the quote when the Featured variant is selected.",
    }),
  },
  ContentView: BlockquotePreview,
});

/** Markdoc tag name (slug). */
export const tagName = "blockquote";
