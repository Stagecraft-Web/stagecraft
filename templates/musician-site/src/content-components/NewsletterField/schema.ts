import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  AUTOCOMPLETE_TOKENS,
  AUTOCOMPLETE_TOKEN_LABELS,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type AutocompleteToken,
  type FieldType,
} from "../_shared/types";
import { NewsletterFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-field`.
 *
 * Child of `{% newsletter-signup %}` — each instance emits one extra input
 * (beyond the always-rendered email field) into the subscribe form. The
 * `name` attribute is the form-field name the newsletter provider expects
 * (e.g. `FNAME` for Mailchimp, `first_name` for ConvertKit, `metadata__name`
 * for Buttondown). We don't remap per service — authors paste whatever their
 * provider's embed code uses verbatim.
 *
 * Self-closing, no body. When used outside a `newsletter-signup` wrapper the
 * tag still validates (markdoc doesn't enforce parent-child relationships by
 * tag name — only by AST node type) but renders nothing meaningful on its own.
 * Authoring-surface convention keeps the tag inside `newsletter-signup`.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterField/NewsletterField.astro",
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
    type: {
      type: String,
      default: "text",
      matches: FIELD_TYPES as unknown as string[],
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    options: {
      type: String,
    },
    placeholder: {
      type: String,
    },
    autocomplete: {
      type: String,
      matches: [...AUTOCOMPLETE_TOKENS],
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Newsletter Field",
  description:
    "Extra input for the Newsletter Signup form. `Name` is the raw form-field name your provider expects (e.g. `FNAME` for Mailchimp, `first_name` for ConvertKit). Use type `select` plus a pipe-separated `Options` list for dropdowns.",
  schema: {
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider. Match your provider's embed exactly — e.g. `FNAME`, `LNAME` (Mailchimp), `first_name` (ConvertKit), `metadata__name` (Buttondown).",
      validation: { length: { min: 1 } },
    }),
    label: fields.text({
      label: "Label",
      description: "Shown next to the input in the rendered form.",
      validation: { length: { min: 1 } },
    }),
    type: fields.select({
      label: "Type",
      description: "Input shape.",
      options: FIELD_TYPES.map((v) => ({
        label: FIELD_TYPE_LABELS[v],
        value: v,
      })) as [
        { label: string; value: FieldType },
        ...{ label: string; value: FieldType }[],
      ],
      defaultValue: "text",
    }),
    isRequired: fields.checkbox({
      label: "Required",
      description: "Browser blocks submit until this field has a value.",
      defaultValue: false,
    }),
    options: fields.text({
      label: "Options",
      description:
        "Pipe-separated choices for Type = Select (e.g. `Friend|Social|Other`). Ignored for other types.",
      defaultValue: "",
    }),
    placeholder: fields.text({
      label: "Placeholder",
      description: "Optional. Grey hint text shown inside an empty input.",
      defaultValue: "",
    }),
    autocomplete: fields.select({
      label: "Autocomplete",
      description:
        "HTML `autocomplete` token. Helps browsers prefill the field from saved profile data — pick the option that best matches what the field is asking for.",
      options: AUTOCOMPLETE_TOKENS.map((v) => ({
        label: AUTOCOMPLETE_TOKEN_LABELS[v],
        value: v,
      })) as [
        { label: string; value: AutocompleteToken },
        ...{ label: string; value: AutocompleteToken }[],
      ],
      defaultValue: "off",
    }),
  },
  ContentView: NewsletterFieldPreview,
});

export const tagName = "newsletter-field";
