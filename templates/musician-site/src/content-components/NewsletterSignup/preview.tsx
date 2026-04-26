import type { ReactNode } from "react";
import {
  previewAccent,
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";
import {
  NEWSLETTER_SERVICE_LABELS,
  type NewsletterService,
} from "../_shared/types";

type NewsletterSignupValue = {
  service: NewsletterService;
  // Keystatic's fields.url yields `string | null` (null = empty input in the
  // admin). The renderer rejects null at runtime (markdoc marks the attr
  // required); the preview tolerates it and just shows the stock form.
  actionUrl: string | null;
  title: string;
  submitLabel: string;
  successMessage: string;
};

/**
 * Keystatic admin preview for `newsletter-signup`. Mirrors the shape of
 * ContactFormPreview — stock form rows rendered inline (Keystatic's admin
 * shell doesn't load site CSS). The top-right badge shows which service
 * is wired so editors can tell at a glance whether the current block is
 * targeting Mailchimp, ConvertKit, etc.
 *
 * Child `newsletter-field` blocks render via the `children` slot — the
 * email row is just one of those children (authors must add it explicitly,
 * see schema.ts validate). Keystatic renders nested blocks itself so the
 * field list stays editable inline.
 */
export function NewsletterSignupPreview({
  value,
  children,
}: {
  value: NewsletterSignupValue;
  children: ReactNode;
}): ReactNode {
  const { service, title, submitLabel } = value;
  const badgeLabel = NEWSLETTER_SERVICE_LABELS[service] ?? "Newsletter";

  return (
    <StockPreviewFrame label="Newsletter Signup">
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          background: previewBg,
          border: previewBorder,
          borderRadius: previewRadius,
          padding: "0.875rem",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            display: "inline-flex",
            alignItems: "center",
            padding: "0.125rem 0.5rem",
            background: "#ffffff",
            border: previewBorder,
            borderRadius: "999px",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: previewText,
          }}
        >
          {badgeLabel}
        </span>

        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: previewText,
            paddingRight: "5rem", // clear space under the badge
          }}
        >
          {title || "Newsletter"}
        </div>

        {children}

        <div style={{ marginTop: "0.25rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: previewAccent,
              color: "#ffffff",
              border: `1px solid ${previewAccent}`,
              padding: "0.5rem 1rem",
              borderRadius: previewRadius,
              fontWeight: 600,
              fontSize: "0.8125rem",
              lineHeight: 1,
            }}
          >
            {submitLabel || "Subscribe"}
          </span>
        </div>
      </div>
      <CaptionNote>
        POSTs to the configured {badgeLabel} endpoint. Includes a hidden honeypot.
      </CaptionNote>
    </StockPreviewFrame>
  );
}
