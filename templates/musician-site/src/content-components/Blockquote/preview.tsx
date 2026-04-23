import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { CaptionNote } from "../_shared/previewChrome";
import type { BlockquoteVariant } from "../_shared/types";
import { BLOCKQUOTE_VARIANT_LABELS } from "../_shared/types";

type BlockquoteValue = {
  variant: BlockquoteVariant;
  attribution: string;
};

export function BlockquotePreview({
  value,
  children,
}: {
  value: BlockquoteValue;
  children: ReactNode;
}): ReactNode {
  const { variant, attribution } = value;
  const isFeatured = variant === "featured";

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.75rem 1rem",
      }}
    >
      <blockquote
        style={{
          margin: 0,
          padding: isFeatured ? "0.5rem 0" : "0 0 0 0.75rem",
          borderLeft: isFeatured ? "none" : `3px solid ${previewText}`,
          textAlign: isFeatured ? "center" : "left",
          fontSize: isFeatured ? "1.125rem" : "0.9375rem",
          fontStyle: "italic",
          fontWeight: isFeatured ? 600 : 400,
          color: previewText,
          maxWidth: isFeatured ? "36rem" : undefined,
          marginInline: isFeatured ? "auto" : undefined,
          lineHeight: 1.4,
        }}
      >
        {children}
        {isFeatured && attribution && (
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
            {"\u2014 "}
            {attribution}
          </cite>
        )}
      </blockquote>
      <CaptionNote>
        Variant: {BLOCKQUOTE_VARIANT_LABELS[variant] ?? variant}
      </CaptionNote>
    </div>
  );
}
