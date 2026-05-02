/**
 * Shared layout chrome used by multiple content-component previews.
 * See ./previewTokens.ts for why inline styles (no site CSS vars).
 */
import type { ReactNode } from "react";
import {
  previewBorderStrong,
  previewBgMuted,
  previewTextMuted,
  previewRadius,
  labelStyle,
} from "./previewTokens";

export function StockPreviewFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      style={{
        border: previewBorderStrong,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.75rem",
      }}
    >
      <div style={{ ...labelStyle, marginBottom: "0.5rem" }}>{label}</div>
      {children}
    </div>
  );
}

export function CaptionNote({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        marginTop: "0.5rem",
        fontSize: "0.6875rem",
        color: previewTextMuted,
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

export function PlaceholderImage({
  label,
  height,
  isFullBleed = false,
}: {
  label: string;
  height: number;
  isFullBleed?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        height: `${height}px`,
        width: isFullBleed ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        color: previewTextMuted,
        background: isFullBleed
          ? "repeating-linear-gradient(45deg, #e4e4e7, #e4e4e7 10px, #f4f4f5 10px, #f4f4f5 20px)"
          : undefined,
        borderRadius: "4px",
      }}
    >
      <ImageIcon />
      <div style={{ fontSize: "0.75rem" }}>{label}</div>
    </div>
  );
}

export function ImageIcon(): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
