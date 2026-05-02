import type { ReactNode } from "react";
import { previewRadius, previewBorder, previewText, previewTextMuted } from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

/**
 * Admin preview for the `posts-list` block.
 *
 * Renders inside Keystatic's admin shell which does NOT load the site's
 * design tokens, so hex values here are the curated neutrals from
 * previewTokens (see that file's comment for rationale).
 */
export function PostsListPreview(): ReactNode {
  const placeholders = Array.from({ length: 3 });
  return (
    <StockPreviewFrame label="Posts List">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.5rem",
        }}
      >
        {placeholders.map((_, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: "column",
              border: previewBorder,
              borderRadius: previewRadius,
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                aspectRatio: "16 / 9",
                background: `linear-gradient(135deg, hsl(${(index * 67) % 360} 30% 80%) 0%, hsl(${(index * 67 + 40) % 360} 30% 70%) 100%)`,
              }}
            />
            <div style={{ padding: "0.5rem" }}>
              <div
                style={{
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: previewTextMuted,
                  marginBottom: "0.25rem",
                }}
              >
                News
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: previewText,
                  marginBottom: "0.25rem",
                  lineHeight: 1.25,
                }}
              >
                Post title placeholder
              </div>
              <div style={{ fontSize: "0.625rem", color: previewTextMuted }}>
                Sep 1, 2024
              </div>
            </div>
          </div>
        ))}
      </div>
      <CaptionNote>
        Populated from your Posts collection at render time. Sorted newest first.
      </CaptionNote>
    </StockPreviewFrame>
  );
}
