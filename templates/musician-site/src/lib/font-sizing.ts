// ============================================================
// Font-sizing — CMS-editable nudges layered on top of theme.json.
//
// Shipping a knob for type scale means authors no longer need to hand-edit
// theme.json (a dev-level file). The three composable controls:
//
//   1. `fontSizeScale`  — Compact / Regular / Spacious preset. Baseline
//                         multiplier applied uniformly to every bucket.
//   2. `fontSizeAdjust` — -2 … +2 integer stepper. ~7% per step, applied
//                         uniformly on top of the scale preset.
//   3. `headingScale`   — -2 … +2 integer stepper, applied ONLY to heading
//                         buckets (xl / 2xl / 3xl / 4xl) in addition to
//                         1 and 2. Lets authors bump headings without
//                         scaling body text.
//
// The final multiplier for a bucket is:
//   SCALE_MULTIPLIERS[scale] * (1 + adjust * 0.07)  for non-heading buckets
//   SCALE_MULTIPLIERS[scale] * (1 + adjust * 0.07) * (1 + heading * 0.07)
//                                                  for heading buckets
//
// Baseline values come from `theme.json` → `typography.fontSize`, which
// remains the dev-level single source of truth. `BaseLayout` passes the
// baseline through `computeFontSizes` and writes `--font-size-*` CSS vars.
// ============================================================

import type { FontSizeScale } from "./schemas.js";

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

// Buckets that render as heading sizes per `global.css`:
//   h1 → 4xl, h2 → 3xl, h3 → 2xl, h4 → xl, h5 → lg, h6 → base.
// The "heading adjust" knob should scale the visually-heading tiers without
// dragging lg/base into it (those double as large body copy). Keep this set
// to xl / 2xl / 3xl / 4xl — the four tiers that are only ever used for
// h1–h4.
export const HEADING_FONT_SIZE_KEYS: ReadonlySet<FontSizeKey> = new Set([
  "xl",
  "2xl",
  "3xl",
  "4xl",
]);

// Scale presets — compact is ~10% smaller, spacious ~10% larger. Regular is
// identity (1.0), which is important for the "no knobs set → byte-for-byte
// match against theme.json" invariant exercised by the test suite.
export const FONT_SIZE_SCALE_MULTIPLIERS: Record<FontSizeScale, number> = {
  compact: 0.9,
  regular: 1,
  spacious: 1.1,
};

// Per-step multiplier for the `fontSizeAdjust` and `headingScale` stepper
// knobs. 7% per step gives a perceptible-but-not-jumpy nudge across the
// 5-position (-2…+2) range: -14% at the low end, +14% at the high end.
export const SIZE_ADJUSTMENT_MULTIPLIER = (steps: number): number =>
  1 + steps * 0.07;

// Keep CSS output clean (e.g. "1.077rem" rather than "1.0769999999999997rem").
// Three decimals is plenty of resolution for rem sizes and guards against
// float-print drift in generated CSS.
function roundRem(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Parse a rem string ("1.25rem" → 1.25). Falls back to NaN on malformed
// input; callers are expected to have run theme.json through Zod already.
function parseRem(value: string): number {
  const match = /^(-?\d+(?:\.\d+)?)rem$/.exec(value.trim());
  return match ? Number(match[1]) : Number.NaN;
}

/**
 * Apply the sizing knobs to the baseline font-size map from theme.json.
 *
 * - `base` is the raw `typography.fontSize` map (rem strings per bucket).
 * - `scale` picks one of Compact / Regular / Spacious (preset multiplier).
 * - `adjust` adds an integer-step nudge on top of the preset (applied to
 *   every bucket).
 * - `headingAdjust` adds an additional nudge to heading buckets only
 *   (HEADING_FONT_SIZE_KEYS — see above).
 *
 * Returns a bucket → rem-string map with the same keys as the input. Buckets
 * in the input that aren't in `FONT_SIZE_KEYS` pass through unchanged, so
 * theme.json can carry extra buckets without breaking this helper.
 */
export function computeFontSizes(
  base: Record<string, string>,
  scale: FontSizeScale,
  adjust: number,
  headingAdjust: number,
): Record<string, string> {
  const scaleMul = FONT_SIZE_SCALE_MULTIPLIERS[scale];
  const adjustMul = SIZE_ADJUSTMENT_MULTIPLIER(adjust);
  const headingMul = SIZE_ADJUSTMENT_MULTIPLIER(headingAdjust);

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    const rem = parseRem(value);
    if (!Number.isFinite(rem)) {
      // Preserve unparseable values (e.g. px strings or CSS calc()) verbatim.
      out[key] = value;
      continue;
    }
    const isHeading = HEADING_FONT_SIZE_KEYS.has(key as FontSizeKey);
    const total = scaleMul * adjustMul * (isHeading ? headingMul : 1);
    out[key] = `${roundRem(rem * total)}rem`;
  }
  return out;
}
