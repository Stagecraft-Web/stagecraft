/**
 * Shared visual tokens for Keystatic content-component previews.
 *
 * These render inside Keystatic's admin shell (the /keystatic route), which
 * does NOT load the site's global.css. That's why we use inline styles with
 * hardcoded neutral colors here rather than referencing --color-* CSS
 * variables from the site design system — the variables wouldn't resolve.
 */
import type { CSSProperties } from "react";

export const previewBorder = "1px solid #d4d4d8";
export const previewBorderStrong = "1px solid #a1a1aa";
export const previewBg = "#ffffff";
export const previewBgMuted = "#f4f4f5";
export const previewText = "#18181b";
export const previewTextMuted = "#71717a";
export const previewAccent = "#2563eb";
export const previewRadius = "6px";

export const labelStyle: CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: previewTextMuted,
};
