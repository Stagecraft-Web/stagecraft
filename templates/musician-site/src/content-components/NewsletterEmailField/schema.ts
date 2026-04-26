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
import { NewsletterEmailFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-email`.
 *
 * The dedicated email-input child for `{% newsletter-signup %}`. Splitting
 * the per-type field blocks (was a single `newsletter-field` with a `type`
 * attribute) lets keystatic prepopulate the right defaults the moment the
 * author picks "Newsletter Field: Email" from the inserter — no
 * `fields.conditional` needed.
 *
 * Two-segment kebab name to stay inside @astrojs/markdoc's `toImportName`
 * safe zone (see TourDatesList/schema.ts for the bug rationale).
 *
 * NewsletterSignup's build-time `validate` looks for at least one
 * `newsletter-email` tag in its descendants, so removing this block from a
 * signup form fails the build with a clear error.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterEmailField/NewsletterEmailField.astro",
  selfClosing: true,
  attributes: {
    name: {
      type: String,
      default: "email",
    },
    label: {
      type: String,
      default: "Email",
    },
    autocomplete: {
      type: String,
      default: "email",
      matches: [...AUTOCOMPLETE_TOKENS],
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    placeholder: {
      type: String,
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Newsletter Field: Email",
  description:
    "Email input for the Newsletter Signup form. Pre-filled with sensible defaults — most authors only edit `name` (Mailchimp users override to `EMAIL` uppercase).",
  schema: {
    label: fields.text({
      label: "Label",
      description:
        "Shown next to the input. Defaults to 'Email' if left blank — change only if you want a different visible label.",
      defaultValue: "Email",
    }),
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider. Defaults to 'email'. Mailchimp users override to `EMAIL` (uppercase); ConvertKit uses `email_address`.",
      defaultValue: "email",
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
      defaultValue: "email",
    }),
    isRequired: fields.checkbox({
      label: "Required",
      description:
        "Browser blocks submit until this field has a value. Most signup forms keep this on.",
      defaultValue: true,
    }),
    placeholder: fields.text({
      label: "Placeholder",
      description: "Optional grey hint text inside the empty input.",
      defaultValue: "",
    }),
  },
  ContentView: NewsletterEmailFieldPreview,
});

export const tagName = "newsletter-email";
