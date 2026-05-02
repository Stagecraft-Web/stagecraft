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

const mockContactFields: ReadonlyArray<{
  label: string;
  isTextarea?: boolean;
  placeholder?: string;
}> = [
  { label: "Name", placeholder: "Your name" },
  { label: "Email", placeholder: "you@example.com" },
  { label: "Subject", placeholder: "What's this about?" },
  { label: "Message", isTextarea: true, placeholder: "Write your message…" },
];

export function ContactFormPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Contact Form">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          background: previewBg,
          border: previewBorder,
          borderRadius: previewRadius,
          padding: "0.875rem",
        }}
      >
        {mockContactFields.map((field) => (
          <div
            key={field.label}
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: previewText,
              }}
            >
              {field.label}
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
                minHeight: field.isTextarea ? "4rem" : undefined,
              }}
            >
              {field.placeholder}
            </div>
          </div>
        ))}
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
            Send Message
          </span>
        </div>
      </div>
      <CaptionNote>Name, email, subject, and message fields. Submits to /api/contact.</CaptionNote>
    </StockPreviewFrame>
  );
}
