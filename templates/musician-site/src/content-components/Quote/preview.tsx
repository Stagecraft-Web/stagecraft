import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";

type QuoteValue = {
  text: string;
  attribution: string;
};

export function QuotePreview({ value }: { value: QuoteValue }): ReactNode {
  const { text, attribution } = value;

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "1rem 1.25rem",
      }}
    >
      <blockquote
        style={{
          margin: 0,
          padding: 0,
          maxWidth: "36rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontStyle: "italic",
            fontWeight: 600,
            color: previewText,
            lineHeight: 1.4,
          }}
        >
          {text || "Quote text…"}
        </p>
        {attribution && (
          <cite
            style={{
              display: "block",
              marginTop: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 400,
              fontStyle: "normal",
              color: previewTextMuted,
            }}
          >
            {"— "}
            {attribution}
          </cite>
        )}
      </blockquote>
    </div>
  );
}
