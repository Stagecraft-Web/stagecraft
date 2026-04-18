import type { CSSProperties, ReactNode } from "react";
import {
  previewAccent,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";

type ButtonValue = {
  label: string;
  href: string;
  variant: "primary" | "outline";
  isExternal: boolean;
};

export function ButtonPreview({ value }: { value: ButtonValue }): ReactNode {
  const { label, href, variant, isExternal } = value;
  const isPrimary = variant === "primary";

  const buttonStyle: CSSProperties = isPrimary
    ? {
        background: previewAccent,
        color: "#ffffff",
        border: `1px solid ${previewAccent}`,
      }
    : {
        background: "transparent",
        color: previewText,
        border: `2px solid ${previewText}`,
      };

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "0.25rem",
        padding: "0.5rem",
      }}
    >
      <span
        style={{
          ...buttonStyle,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.5rem 1rem",
          borderRadius: previewRadius,
          fontWeight: 600,
          fontSize: "0.875rem",
          lineHeight: 1,
        }}
      >
        {label || "Button"}
        {isExternal && <ExternalLinkIcon />}
      </span>
      {href && (
        <span
          style={{
            fontSize: "0.6875rem",
            color: previewTextMuted,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          }}
        >
          {"\u2192 "}
          {href}
        </span>
      )}
    </div>
  );
}

function ExternalLinkIcon(): ReactNode {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
