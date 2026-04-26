import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
} from "./previewTokens";

/**
 * Shared compact tile for Newsletter Field block previews. Each
 * `newsletter-{email,phone,text,select}` block renders a tile with the
 * field's label, a type badge, and a hint line — same layout, different
 * content. Pulling the tile here keeps the per-field preview files small
 * and the visual style aligned across all four blocks.
 */
export function NewsletterFieldTile({
  label,
  typeBadge,
  isRequired,
  hint,
}: {
  label: string;
  typeBadge: string;
  isRequired: boolean;
  hint: ReactNode;
}): ReactNode {
  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.5rem 0.625rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: previewText,
          }}
        >
          {label}
          {isRequired && (
            <span style={{ color: "#dc2626", marginLeft: "0.25rem" }}>*</span>
          )}
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            color: previewTextMuted,
            fontFamily: "monospace",
          }}
        >
          {typeBadge}
        </div>
      </div>
      <div
        style={{
          border: previewBorder,
          borderRadius: "4px",
          background: previewBgMuted,
          padding: "0.375rem 0.5rem",
          fontSize: "0.75rem",
          color: previewTextMuted,
          fontStyle: "italic",
        }}
      >
        {hint}
      </div>
    </div>
  );
}
