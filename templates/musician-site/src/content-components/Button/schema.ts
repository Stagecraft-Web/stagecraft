import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import { BUTTON_VARIANTS, BUTTON_VARIANT_LABELS } from "../_shared/types";
import { ButtonPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Button/Button.astro",
  selfClosing: true,
  attributes: {
    label: { type: String, required: true },
    href: { type: String },
    variant: {
      type: String,
      default: "primary",
      matches: BUTTON_VARIANTS as unknown as string[],
    },
    isExternal: { type: Boolean, default: false },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Button",
  description: "A styled button or link.",
  schema: {
    label: fields.text({ label: "Label", validation: { isRequired: true } }),
    href: fields.text({ label: "Link URL" }),
    variant: fields.select({
      label: "Variant",
      options: BUTTON_VARIANTS.map((v) => ({
        label: BUTTON_VARIANT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: (typeof BUTTON_VARIANTS)[number] },
        ...{ label: string; value: (typeof BUTTON_VARIANTS)[number] }[],
      ],
      defaultValue: "primary",
    }),
    isExternal: fields.checkbox({ label: "Open in new tab" }),
  },
  ContentView: ButtonPreview,
});

export const tagName = "button";
