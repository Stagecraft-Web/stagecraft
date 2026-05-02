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
import { NewsletterSelectFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-select`. Dropdown child for
 * `{% newsletter-signup %}`. Choices are authored as a pipe-separated
 * `options` string (`"Friend|Social|Other"`) — keeping markdoc attributes
 * flat avoids array-of-object parsing.
 *
 * Two-segment kebab name to stay inside @astrojs/markdoc's `toImportName`
 * safe zone (see TourDatesList/schema.ts for the rationale).
 */
export const markdoc: MarkdocTagDefinition = {
  render:
    "./src/content-components/NewsletterSelectField/NewsletterSelectField.astro",
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
    options: {
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
  label: "Newsletter Field: Select",
  description:
    "Dropdown input for the Newsletter Signup form (e.g. 'How did you hear about us?'). Choices are pipe-separated.",
  schema: {
    label: fields.text({
      label: "Label",
      description: "Shown next to the dropdown.",
      validation: { length: { min: 1 } },
    }),
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider (e.g. `REFERRER`, `source`, `metadata__source`).",
      validation: { length: { min: 1 } },
    }),
    options: fields.text({
      label: "Options",
      description:
        "Pipe-separated choices — for example, `Friend|Social|Show|Other`.",
      validation: { length: { min: 1 } },
    }),
    autocomplete: fields.select({
      label: "Autocomplete",
      description:
        "Selects rarely benefit from autofill; leave as 'Off' unless your provider standardises on a token.",
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
      description: "Browser blocks submit until the user picks a choice.",
      defaultValue: false,
    }),
    placeholder: fields.text({
      label: "Placeholder",
      description:
        "Empty-state prompt option (shown when the field isn't required). Defaults to 'Select an option' if blank.",
      defaultValue: "",
    }),
  },
  ContentView: NewsletterSelectFieldPreview,
});

export const tagName = "newsletter-select";
