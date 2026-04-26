import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  NewsletterService,
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
 * renderer emits a service-specific Mailchimp honeypot at build time. The
 * discriminator is required (no default) so authors explicitly pick a
 * target — silently defaulting to one service would mask a misconfigured
 * action URL.
 *
 * Wrapper tag: authors compose the form by nesting `{% newsletter-field %}`
 * children — including the mandatory email field. The email field is *not*
 * rendered by this block; authors must add a `newsletter-field` with
 * `type="email"` themselves so the field name (which varies per provider —
 * `EMAIL` for Mailchimp, `email_address` for ConvertKit, `email` for the
 * rest) is authored alongside everything else and stays editable.
 *
 * The `validate` callback below enforces the email-field requirement at
 * build time so a misconfigured form fails the build instead of silently
 * shipping without an email input. Markdoc's `Schema.children` filters by
 * AST *node type* ("tag", "paragraph", …) — not tag name — so we can't use
 * it to narrow children to `newsletter-field`; the explicit `validate`
 * walk is the workable equivalent.
 */
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
  validate(node) {
    let hasEmailField = false;
    for (const descendant of node.walk()) {
      if (descendant.type !== "tag") continue;
      if (descendant.tag !== "newsletter-field") continue;
      // Raw attribute — markdoc applies the schema's `default` at transform
      // time, not validate time, so an omitted `type` reads as undefined
      // here. That matches our intent: the email field must be declared
      // explicitly with `type="email"`.
      if (descendant.attributes?.type === "email") {
        hasEmailField = true;
        break;
      }
    }
    if (hasEmailField) return [];
    return [
      {
        id: "newsletter-signup-missing-email",
        level: "error",
        message:
          'newsletter-signup must contain a newsletter-field with type="email" — every newsletter provider requires the subscriber\'s email address.',
      },
    ];
  },
};

export const keystatic: KeystaticContentComponent = wrapper({
  label: "Newsletter Signup",
  description:
    "Email-capture form that POSTs to Mailchimp, ConvertKit, Buttondown, or a custom endpoint. Add `Newsletter Field` blocks inside — at minimum one with type=Email (required) plus any extras you want (first name, referral source, etc.). Uses a hidden honeypot field to deter simple bots. Note: Mailchimp's real bot-trap field is audience-specific (a random `b_xxx_xxx` suffix). This block emits a generic `b_subscribe_honeypot` — it helps, but isn't a full replacement for reCAPTCHA on Mailchimp embeds. For strict anti-spam, paste Mailchimp's own embed HTML directly into a page.",
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
