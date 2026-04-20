import type { ReactNode } from "react";
import {
  previewAccent,
  previewBorder,
  previewBg,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";
import type { NewsletterService } from "./schema";

type NewsletterSignupValue = {
  service: NewsletterService;
  // Keystatic's fields.url yields `string | null` (null = empty input in the
  // admin). The renderer rejects null at runtime (markdoc marks the attr
  // required); the preview tolerates it and just shows the stock form.
  actionUrl: string | null;
  title: string;
  submitLabel: string;
  successMessage: string;
  captureName: boolean;
};

const SERVICE_BADGE_LABEL: Record<NewsletterService, string> = {
  mailchimp: "Mailchimp",
  convertkit: "ConvertKit",
  buttondown: "Buttondown",
  generic: "Generic",
};

/**
 * Keystatic admin preview for `newsletter-signup`. Mirrors the shape of
 * ContactFormPreview — stock form rows rendered inline (Keystatic's admin
 * shell doesn't load site CSS). The top-right badge shows which service
 * is wired so editors can tell at a glance whether the current block is
 * targeting Mailchimp, ConvertKit, etc.
 */
export function NewsletterSignupPreview({
  value,
}: {
  value: NewsletterSignupValue;
}): ReactNode {
  const { service, title, submitLabel, captureName } = value;
  const badgeLabel = SERVICE_BADGE_LABEL[service] ?? "Newsletter";

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

        {captureName && (
          <StockInputRow label="First name" placeholder="Your name" />
        )}
        <StockInputRow label="Email" placeholder="you@example.com" />

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

function StockInputRow({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: previewText,
        }}
      >
        {label}
      </div>
      <div
        style={{
          border: previewBorder,
          borderRadius: "4px",
          background: previewBgMuted,
          padding: "0.5rem 0.625rem",
          fontSize: "0.75rem",
          color: previewTextMuted,
          fontStyle: "italic",
        }}
      >
        {placeholder}
      </div>
    </div>
  );
}
