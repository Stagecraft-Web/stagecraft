import type { FieldType } from "../_shared/types";

/**
 * Per-`type` fallbacks for the `name`, `label`, and `autocomplete` attributes
 * of `{% newsletter-field %}`. The renderer (NewsletterField.astro) uses
 * these whenever the corresponding attribute is absent — so an author can
 * write `{% newsletter-field type="email" /%}` and get a working email input
 * without retyping the obvious values.
 *
 * Only `email` and `tel` provide name/label defaults. `text` and `select`
 * are content-shaped (the author's choice of label and field name carries
 * meaning), so requiring an explicit value catches "I forgot to set this"
 * mistakes rather than silently rendering "name=" / "label=".
 *
 * The Mailchimp caveat (uppercase `EMAIL`) is documented in schema.ts. The
 * default here is lowercase `email` — correct for Buttondown / ConvertKit /
 * generic; Mailchimp users override.
 */
export const DEFAULT_NAME_FOR_TYPE: Partial<Record<FieldType, string>> = {
  email: "email",
  tel: "phone",
};

export const DEFAULT_LABEL_FOR_TYPE: Partial<Record<FieldType, string>> = {
  email: "Email",
  tel: "Phone",
};

/** Browser autofill tokens that match each input type's purpose. `text` and
 *  `select` get no default — autofill on those is content-specific. */
export const DEFAULT_AUTOCOMPLETE_FOR_TYPE: Partial<Record<FieldType, string>> =
  {
    email: "email",
    tel: "tel",
  };
