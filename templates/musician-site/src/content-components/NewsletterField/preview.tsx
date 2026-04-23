import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import type { FieldType } from "../_shared/types";
import { FIELD_TYPE_LABELS } from "../_shared/types";
import { parseFieldOptions } from "./parseFieldOptions";

type NewsletterFieldValue = {
  name: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  options: string;
  placeholder: string;
  autocomplete: string;
};

/**
 * Keystatic admin preview for `newsletter-field`. Renders as a compact label
 * + stock control so editors can scan a list of field children inside the
 * parent `newsletter-signup` wrapper and tell them apart at a glance.
 * The actual input rendering lives in NewsletterField.astro — this preview
 * just communicates shape and required-ness.
 */
export function NewsletterFieldPreview({
  value,
}: {
  value: NewsletterFieldValue;
}): ReactNode {
  const { label, type, isRequired, options, placeholder, name } = value;
  const typeLabel = FIELD_TYPE_LABELS[type] ?? type;

  const selectChoices = type === "select" ? parseFieldOptions(options) : [];

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
          {label || name || "Field"}
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
          {typeLabel}
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
        {type === "select"
          ? selectChoices.length > 0
            ? selectChoices.join(" / ")
            : "(no options yet)"
          : placeholder || `name=${name || "…"}`}
      </div>
    </div>
  );
}
