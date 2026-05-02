// ============================================================
// Font-sizing — CMS-editable per-bucket overrides on top of theme.json.
//
// `theme.json → typography.fontSize` is the dev-level baseline (eight buckets:
// xs / sm / base / lg / xl / 2xl / 3xl / 4xl). The Appearance singleton stores
// per-bucket overrides as integer pixels (1rem = 16px, see PX_PER_REM in
// schemas.ts), split into `bodySizes` (xs / sm / base / lg) and
// `headingSizes` (xl / 2xl / 3xl / 4xl). A `0` for any bucket falls through
// to the theme.json baseline.
//
// Replaces the earlier three-knob system (compact/regular/spacious preset +
// global adjust + heading-only adjust). Per-bucket gives the same control
// without the layered-multiplier mental model.
// ============================================================

import { PX_PER_REM } from "./schemas";

// The canonical bucket list (`FONT_SIZE_BUCKETS` in schemas.ts) is the
// single source of truth for the eight buckets — `theme.json`,
// `appearance.json`, the Keystatic admin, and the React sidebar all
// derive from it. This module operates on opaque string-keyed maps so it
// doesn't need its own copy of the union.

/**
 * Format an integer-pixel override as a rem string (e.g. 18 → "1.125rem").
 * Three decimals is plenty of resolution for rem sizes and matches the
 * baseline values in theme.json.
 */
export function pxToRem(px: number): string {
  const rem = px / PX_PER_REM;
  return `${Math.round(rem * 1000) / 1000}rem`;
}

/**
 * Resolve the final per-bucket font-size map.
 *
 * - `base` is the raw `typography.fontSize` map from theme.json (rem strings).
 * - `bodyOverrides` and `headingOverrides` are partial maps from bucket → px
 *   integer. Any bucket whose override is missing OR `0` falls back to the
 *   baseline.
 *
 * Returns a bucket → rem-string map with the same keys as `base`. Buckets in
 * the input that aren't recognised pass through unchanged so theme.json can
 * carry extra buckets without breaking this helper.
 */
export function computeFontSizes(
  base: Record<string, string>,
  bodyOverrides: Partial<Record<string, number>> = {},
  headingOverrides: Partial<Record<string, number>> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, baseValue] of Object.entries(base)) {
    const override = bodyOverrides[key] ?? headingOverrides[key];
    out[key] = override && override > 0 ? pxToRem(override) : baseValue;
  }
  return out;
}
