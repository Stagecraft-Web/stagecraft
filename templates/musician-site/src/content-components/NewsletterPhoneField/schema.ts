import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  AUTOCOMPLETE_TOKENS,
  AUTOCOMPLETE_TOKEN_LABELS,
  type AutocompleteToken,
} from "../_shared/types";
import { NewsletterPhoneFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-phone`. Phone-input child for
 * `{% newsletter-signup %}`. Pre-filled with phone-friendly defaults.
 *
 * Two-segment kebab name to stay inside @astrojs/markdoc's `toImportName`
 * safe zone (see TourDatesList/schema.ts for the rationale).
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterPhoneField/NewsletterPhoneField.astro",
  selfClosing: true,
  attributes: {
    name: {
      type: String,
      default: "phone",
    },
    label: {
      type: String,
      default: "Phone",
    },
    autocomplete: {
      type: String,
      default: "tel",
      matches: [...AUTOCOMPLETE_TOKENS],
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Newsletter Field: Phone",
  description:
    "Phone-number input for the Newsletter Signup form. Pre-filled with phone-friendly defaults — change `name` if your provider expects a different key.",
  schema: {
    label: fields.text({
      label: "Label",
      description:
        "Shown next to the input. Defaults to 'Phone' if left blank.",
      defaultValue: "Phone",
    }),
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider. Defaults to 'phone'. Other common values: `tel`, `PHONE`, `phone_number`.",
      defaultValue: "phone",
    }),
    autocomplete: fields.select({
      label: "Autocomplete",
      description:
        "HTML `autocomplete` token. Browsers prefill from saved profile data.",
      options: AUTOCOMPLETE_TOKENS.map((v) => ({
        label: AUTOCOMPLETE_TOKEN_LABELS[v],
        value: v,
      })) as [
        { label: string; value: AutocompleteToken },
        ...{ label: string; value: AutocompleteToken }[],
      ],
      defaultValue: "tel",
    }),
    isRequired: fields.checkbox({
      label: "Required",
      description: "Browser blocks submit until this field has a value.",
      defaultValue: false,
    }),
    placeholder: fields.text({
      label: "Placeholder",
      description: "Optional grey hint text inside the empty input.",
      defaultValue: "",
    }),
  },
  ContentView: NewsletterPhoneFieldPreview,
});

export const tagName = "newsletter-phone";
