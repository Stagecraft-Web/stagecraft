import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  NEWSLETTER_SERVICES,
  NEWSLETTER_SERVICE_LABELS,
} from "../_shared/types";
import { NewsletterSignupPreview } from "./preview";

/**
 * Markdoc tag `newsletter-signup`.
 *
 * Two-segment kebab — stays inside the safe zone of @astrojs/markdoc's
 * `toImportName` helper (see TourDatesList/schema.ts for the full bug
 * description; three-segment names like `foo-bar-baz` produce invalid JS
 * identifiers at build time).
 *
 * Single discriminator (`service`) selects the newsletter provider; the
 * renderer emits the service-specific form field names at build time so a
 * Mailchimp form gets `EMAIL`, ConvertKit gets `email_address`, etc. The
 * discriminator is required (no default) so authors explicitly pick a
 * target — silently defaulting to one service would mask a misconfigured
 * action URL.
 *
 * Wrapper tag: authors nest `{% newsletter-field %}` children for extra
 * inputs (first name, last name, referral source, …). The email input is
 * always rendered by the parent — never configurable — so the form always
 * has the mandatory primary field.
 *
 * Markdoc's `Schema.children` array filters by AST *node type* ("tag",
 * "paragraph", "heading", etc.) — not by tag name — so we can't narrow to
 * `newsletter-field` at the markdoc layer. The Keystatic wrapper provides
 * the authoring-surface constraint: the admin's "insert block" menu inside
 * this wrapper offers every registered block, but in practice editors pick
 * Newsletter Field because that's what makes sense for the rendered form.
 */

/**
 * Re-export from `_shared/types` so sibling modules
 * (`NewsletterSignup.astro`, `preview.tsx`) can keep importing from
 * `./schema` without knowing the canonical location moved.
 */
export type NewsletterService = (typeof NEWSLETTER_SERVICES)[number];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterSignup/NewsletterSignup.astro",
  attributes: {
    service: {
      type: String,
      required: true,
      matches: [...NEWSLETTER_SERVICES],
    },
    actionUrl: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "Newsletter",
    },
    submitLabel: {
      type: String,
      default: "Subscribe",
    },
    successMessage: {
      type: String,
      default: "Thanks for subscribing!",
    },
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Newsletter Signup",
  description:
    "Email-capture form that POSTs to Mailchimp, ConvertKit, Buttondown, or a custom endpoint. Nest `Newsletter Field` blocks inside to add extra inputs (first name, referral source, etc.) — the email field is always rendered by this block. Uses a hidden honeypot field to deter simple bots. Note: Mailchimp's real bot-trap field is audience-specific (a random `b_xxx_xxx` suffix). This block emits a generic `b_subscribe_honeypot` — it helps, but isn't a full replacement for reCAPTCHA on Mailchimp embeds. For strict anti-spam, paste Mailchimp's own embed HTML directly into a page.",
  schema: {
    service: fields.select({
      label: "Service",
      description: "Which newsletter provider receives the POST.",
      options: NEWSLETTER_SERVICES.map((v) => ({
        label: NEWSLETTER_SERVICE_LABELS[v],
        value: v,
      })) as [
        { label: string; value: NewsletterService },
        ...{ label: string; value: NewsletterService }[],
      ],
      defaultValue: "generic",
    }),
    actionUrl: fields.url({
      label: "Action URL",
      description:
        "The form's POST target. For Mailchimp paste the form action URL from the embed code; for ConvertKit the landing endpoint; for Buttondown the API URL; for Generic any endpoint that accepts a form-encoded POST.",
      validation: { isRequired: true },
    }),
    title: fields.text({
      label: "Title",
      description: "Shown above the form. Leave as 'Newsletter' or customize.",
      defaultValue: "Newsletter",
    }),
    submitLabel: fields.text({
      label: "Submit button label",
      defaultValue: "Subscribe",
    }),
    successMessage: fields.text({
      label: "Success message",
      description: "Shown inline after a successful submit.",
      defaultValue: "Thanks for subscribing!",
    }),
  },
  ContentView: NewsletterSignupPreview,
});

export const tagName = "newsletter-signup";
