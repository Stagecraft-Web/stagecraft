import type { ReactNode } from "react";
import {
  previewAccent,
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

const mockQuotes: ReadonlyArray<{ quote: string; attribution: string }> = [
  {
    quote: "An unforgettable performance that stays with you long after the last note.",
    attribution: "Publication Name",
  },
  {
    quote: "A bold new voice in contemporary music — original, confident, and deeply moving.",
    attribution: "Critic's Name, Magazine",
  },
];

export function PressQuotesPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Press Quotes">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
      >
        {mockQuotes.map((q) => (
          <blockquote
            key={q.attribution}
            style={{
              margin: 0,
              padding: "0.875rem 1rem",
              border: previewBorder,
              borderLeft: `3px solid ${previewAccent}`,
              borderRadius: previewRadius,
              background: previewBg,
            }}
          >
            <div
              style={{
                fontSize: "0.8125rem",
                fontStyle: "italic",
                color: previewText,
                lineHeight: 1.5,
                marginBottom: "0.5rem",
              }}
            >
              &ldquo;{q.quote}&rdquo;
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: previewTextMuted,
                fontWeight: 500,
              }}
            >
              — {q.attribution}
            </div>
          </blockquote>
        ))}
      </div>
      <CaptionNote>Populated from your Press Quotes collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}
