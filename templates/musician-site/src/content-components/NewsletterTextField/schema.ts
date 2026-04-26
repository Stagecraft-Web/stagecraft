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
import { NewsletterTextFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-text`. Generic text-input child for
 * `{% newsletter-signup %}`. Use for fields that don't fit the email/phone
 * presets — first/last name, custom metadata, referrer source, etc.
 *
 * Two-segment kebab name to stay inside @astrojs/markdoc's `toImportName`
 * safe zone (see TourDatesList/schema.ts for the rationale).
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterTextField/NewsletterTextField.astro",
  selfClosing: true,
  attributes: {
    name: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    autocomplete: {
      type: String,
      default: "off",
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
  label: "Newsletter Field: Text",
  description:
    "Plain text input for the Newsletter Signup form. For first/last name, custom metadata, or any field that isn't an email or phone.",
  schema: {
    label: fields.text({
      label: "Label",
      description: "Shown next to the input (e.g. `First name`).",
      validation: { length: { min: 1 } },
    }),
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider. Match your provider's embed exactly — e.g. `FNAME` / `LNAME` (Mailchimp), `first_name` (ConvertKit), `metadata__name` (Buttondown).",
      validation: { length: { min: 1 } },
    }),
    autocomplete: fields.select({
      label: "Autocomplete",
      description:
        "HTML `autocomplete` token. Pick the one that matches what this field captures — `First name`, `Last name`, etc.",
      options: AUTOCOMPLETE_TOKENS.map((v) => ({
        label: AUTOCOMPLETE_TOKEN_LABELS[v],
        value: v,
      })) as [
        { label: string; value: AutocompleteToken },
        ...{ label: string; value: AutocompleteToken }[],
      ],
      defaultValue: "off",
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
  ContentView: NewsletterTextFieldPreview,
});

export const tagName = "newsletter-text";
