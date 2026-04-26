// ============================================================
// Font-sizing — CMS-editable per-bucket overrides on top of theme.json.
//
// `theme.json → typography.fontSize` is the dev-level baseline (eight buckets:
// xs / sm / base / lg / xl / 2xl / 3xl / 4xl). The Appearance singleton stores
// per-bucket overrides split into `bodySizes` (xs / sm / base / lg) and
// `headingSizes` (xl / 2xl / 3xl / 4xl); each bucket is a rem string or "" to
// fall through to the baseline.
//
// Replaces the earlier three-knob system (compact/regular/spacious preset +
// global adjust + heading-only adjust). Per-bucket gives the same control
// without the layered-multiplier mental model.
// ============================================================

// Canonical 8-step scale mirrors theme.json → typography.fontSize. Also
// mirrored in `src/styles/global.css` (which maps `h1..h6` onto size vars).
// Any new bucket added here must also show up in both places.
export const FONT_SIZE_KEYS = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
] as const;
export type FontSizeKey = (typeof FONT_SIZE_KEYS)[number];

/**
 * Resolve the final per-bucket font-size map.
 *
 * - `base` is the raw `typography.fontSize` map from theme.json.
 * - `bodyOverrides` and `headingOverrides` are partial maps from bucket → rem
 *   string. Any bucket whose override is absent OR an empty string falls back
 *   to the baseline.
 *
 * Returns a bucket → rem-string map with the same keys as `base`. Buckets in
 * the input that aren't recognised pass through unchanged so theme.json can
 * carry extra buckets without breaking this helper.
 */
export function computeFontSizes(
  base: Record<string, string>,
  bodyOverrides: Partial<Record<string, string>> = {},
  headingOverrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, baseValue] of Object.entries(base)) {
    const override = bodyOverrides[key] ?? headingOverrides[key];
    out[key] = override && override.trim().length > 0 ? override : baseValue;
  }
  return out;
}
