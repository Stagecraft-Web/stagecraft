// ============================================================
// WCAG 2.x color-contrast utilities.
//
// Pure functions — no canvas / browser APIs — so they run in the Zod
// `superRefine` (Node, during `validate:content`) and in the React
// appearance sidebar (browser) unchanged.
//
// The checker deliberately enumerates specific foreground/background
// pairs rather than trying to infer roles from token names. `secondary`
// is a foreground on outline buttons but a background on filled buttons,
// so token-name heuristics would misclassify half the cases. Adding a
// new color token requires an explicit decision about which pairs it
// participates in — that's the right friction.
//
// WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum) requires:
//   - 4.5:1 for normal body text (AA)
//   - 3:1 for "large" text (18pt / 14pt bold) and graphical objects (AA-large)
// See: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
// ============================================================

// The post-transform shape of `appearanceSchema.colors`. Declared here (rather
// than imported from `./schemas`) to avoid an import cycle: `schemas.ts`
// consumes `checkContrast` in its `superRefine`, so `color-contrast.ts` can't
// depend on it in return. `schemas.ts` assigns its `keyof Appearance["colors"]`
// into this type at the call site — if a new color is added to the schema
// without being added here, the TS compiler will flag the mismatch.
export type AppearanceColors = {
  primary: string;
  secondary: string;
  accent: string;
  linkColor: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
};
export type AppearanceColorKey = keyof AppearanceColors;

// Either a reference to one of the named appearance colors, or a literal
// hex/rgb string. The literal form is for pairs where the foreground or
// background is fixed regardless of theme — e.g. button labels that are
// hard-coded to white in the CSS.
export type ColorRef = { key: AppearanceColorKey } | { literal: string };

export interface ContrastPair {
  fg: ColorRef;
  bg: ColorRef;
  level: "AA" | "AA-large";
  /** User-readable description of the pair. Shown in warnings. */
  label: string;
}

/**
 * The full list of foreground / background pairs the site renders in practice.
 *
 * Each pair names the level required for the kind of content rendered with
 * that combination:
 *   - AA        (4.5:1) for body text and small UI labels
 *   - AA-large  (3:1)   for large/heading text, muted captions that render
 *                        larger than body, and graphical objects (borders)
 *
 * To add a new color role, add one or more entries here rather than relying
 * on name-based inference.
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: { key: "text" },        bg: { key: "background" }, level: "AA",       label: "Body text on page" },
  { fg: { key: "text" },        bg: { key: "surface" },    level: "AA",       label: "Body text on cards" },
  { fg: { key: "textMuted" },   bg: { key: "background" }, level: "AA-large", label: "Muted text on page" },
  { fg: { key: "textMuted" },   bg: { key: "surface" },    level: "AA-large", label: "Muted text on cards" },
  { fg: { key: "primary" },     bg: { key: "background" }, level: "AA",       label: "Headings / logo on page" },
  { fg: { key: "linkColor" },   bg: { key: "background" }, level: "AA",       label: "Links on page" },
  { fg: { key: "linkColor" },   bg: { key: "surface" },    level: "AA",       label: "Links on cards" },
  { fg: { literal: "#ffffff" }, bg: { key: "secondary" },  level: "AA",       label: "Button label (white) on secondary" },
  { fg: { key: "secondary" },   bg: { key: "background" }, level: "AA",       label: "Outline-button label / accents on page" },
  { fg: { key: "border" },      bg: { key: "background" }, level: "AA-large", label: "Borders on page" },
];

export const REQUIRED_RATIOS: Record<"AA" | "AA-large", number> = {
  AA: 4.5,
  "AA-large": 3.0,
};

// ============================================================
// Color parsing
// ============================================================

const HEX_3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
// rgb() / rgba() — accepts integers or percentages for channels, and
// optional alpha (we ignore it for contrast purposes). Whitespace tolerant,
// comma or space separators.
const RGB_FN = /^rgba?\(\s*([^,\s]+)\s*[,\s]\s*([^,\s]+)\s*[,\s]\s*([^,\s)]+)\s*(?:[,/]\s*[^)]+)?\)$/i;

function parseChannel(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const pct = Number(trimmed.slice(0, -1));
    if (!Number.isFinite(pct)) return null;
    return Math.round((pct / 100) * 255);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  // Clamp to 0–255; WCAG cares about the 8-bit channel value.
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Parse a CSS color into its 8-bit RGB channels. Accepts `#rgb`, `#rrggbb`,
 * `#rrggbbaa` (alpha ignored), and `rgb()` / `rgba()` forms. Returns `null`
 * for anything it can't parse (named colors, hsl(), etc.) — the caller is
 * expected to treat an unparseable value as "can't compute ratio" rather
 * than an assertion failure.
 */
export function parseColor(input: string): { r: number; g: number; b: number } | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (s.length === 0) return null;

  const m3 = HEX_3.exec(s);
  if (m3) {
    return {
      r: parseInt(m3[1] + m3[1], 16),
      g: parseInt(m3[2] + m3[2], 16),
      b: parseInt(m3[3] + m3[3], 16),
    };
  }
  const m6 = HEX_6.exec(s);
  if (m6) {
    return {
      r: parseInt(m6[1], 16),
      g: parseInt(m6[2], 16),
      b: parseInt(m6[3], 16),
    };
  }
  const m8 = HEX_8.exec(s);
  if (m8) {
    return {
      r: parseInt(m8[1], 16),
      g: parseInt(m8[2], 16),
      b: parseInt(m8[3], 16),
      // alpha dropped; contrast is computed against the opaque color
    };
  }
  const rgbM = RGB_FN.exec(s);
  if (rgbM) {
    const r = parseChannel(rgbM[1]);
    const g = parseChannel(rgbM[2]);
    const b = parseChannel(rgbM[3]);
    if (r === null || g === null || b === null) return null;
    return { r, g, b };
  }
  return null;
}

// ============================================================
// WCAG relative luminance + contrast ratio
// ============================================================

// Per WCAG: linearise each channel, weight by luminous efficiency of RGB
// primaries, sum. The formulas below match
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance exactly.
function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Return the WCAG contrast ratio between two colors, in the range [1, 21].
 *
 * - 1 means the two colors are identical (or equivalent luminance).
 * - 21 is the max (pure black vs pure white).
 *
 * Returns `NaN` when either input can't be parsed. Callers can test with
 * `Number.isNaN(ratio)` to distinguish "failed to compute" from a real
 * low-contrast result (which is a finite value < the required threshold).
 */
export function getContrastRatio(fg: string, bg: string): number {
  const fgRgb = parseColor(fg);
  const bgRgb = parseColor(bg);
  if (!fgRgb || !bgRgb) return Number.NaN;
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Pair resolution + checking
// ============================================================

/** Dereference a `ColorRef` against a concrete `colors` object. */
export function resolveColorRef(ref: ColorRef, colors: AppearanceColors): string {
  if ("literal" in ref) return ref.literal;
  return colors[ref.key];
}

export interface ContrastResult {
  pair: ContrastPair;
  ratio: number;
  passes: boolean;
  required: number;
}

/**
 * Evaluate every `CONTRAST_PAIRS` entry against the provided colors.
 * A pair "passes" when its computed ratio meets or exceeds the required
 * threshold for its level. Unparseable colors produce a ratio of `NaN`
 * and fail automatically — a malformed hex in the CMS shouldn't silently
 * bypass the check.
 */
export function checkContrast(colors: AppearanceColors): ContrastResult[] {
  return CONTRAST_PAIRS.map((pair) => {
    const fg = resolveColorRef(pair.fg, colors);
    const bg = resolveColorRef(pair.bg, colors);
    const ratio = getContrastRatio(fg, bg);
    const required = REQUIRED_RATIOS[pair.level];
    const passes = Number.isFinite(ratio) && ratio >= required;
    return { pair, ratio, passes, required };
  });
}
