import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  ButtonVariant,
} from "../_shared/types";
import { ButtonPreview } from "./preview";

const BUTTON_VARIANTS: readonly ButtonVariant[] = ["primary", "outline"];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/Button/Button.astro",
  selfClosing: true,
  attributes: {
    label: { type: String, required: true },
    href: { type: String },
    variant: { type: String, default: "primary", matches: [...BUTTON_VARIANTS] },
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
      options: [
        { label: "Primary", value: "primary" },
        { label: "Outline", value: "outline" },
      ],
      defaultValue: "primary",
    }),
    isExternal: fields.checkbox({ label: "Open in new tab" }),
  },
  ContentView: ButtonPreview,
});

export const tagName = "button";
