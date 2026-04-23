import { describe, it, expect } from "vitest";
import {
  FONT_SIZE_KEYS,
  FONT_SIZE_SCALE_MULTIPLIERS,
  HEADING_FONT_SIZE_KEYS,
  SIZE_ADJUSTMENT_MULTIPLIER,
  computeFontSizes,
} from "../font-sizing";

// Mirrors the default scale in src/content/config/theme.json. Keeping it here
// keeps this test file hermetic (no fs reads) and makes the expected ratios
// legible without cross-referencing another file.
const BASE = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "2.5rem",
  "4xl": "3.5rem",
};

describe("computeFontSizes", () => {
  it("returns the baseline verbatim when every knob is at its default", () => {
    // Identity invariant: regular × 0 × 0 → multiplier = 1 for every bucket.
    // Output must equal the input byte-for-byte so sites that don't set any
    // `sizing` knobs render identically to the current behavior.
    const out = computeFontSizes(BASE, "regular", 0, 0);
    expect(out).toEqual(BASE);
  });

  it("applies the compact preset uniformly", () => {
    const out = computeFontSizes(BASE, "compact", 0, 0);
    // 1rem * 0.9 = 0.9rem (rounded to 3 decimals).
    expect(out.base).toBe("0.9rem");
    expect(out.xs).toBe("0.675rem");
    expect(out["4xl"]).toBe("3.15rem");
  });

  it("applies the spacious preset uniformly", () => {
    const out = computeFontSizes(BASE, "spacious", 0, 0);
    expect(out.base).toBe("1.1rem");
    expect(out.xs).toBe("0.825rem");
    expect(out["4xl"]).toBe("3.85rem");
  });

  it("layers fontSizeAdjust on top of the scale preset", () => {
    // Regular scale (1.0) × +1 step (1.07) = 1.07x applied uniformly.
    const out = computeFontSizes(BASE, "regular", 1, 0);
    expect(out.base).toBe("1.07rem");
    // 0.75 * 1.07 = 0.8025 → rounds to 0.803rem.
    expect(out.xs).toBe("0.803rem");
  });

  it("supports negative fontSizeAdjust (e.g. -2 = ~14% smaller)", () => {
    const out = computeFontSizes(BASE, "regular", -2, 0);
    // 1 * (1 - 2*0.07) = 1 * 0.86 = 0.86rem.
    expect(out.base).toBe("0.86rem");
    expect(out["4xl"]).toBe("3.01rem");
  });

  it("combines scale preset and fontSizeAdjust multiplicatively", () => {
    // Compact (0.9) × +2 step (1.14) = 1.026x applied uniformly.
    const out = computeFontSizes(BASE, "compact", 2, 0);
    expect(out.base).toBe("1.026rem");
    // 1.5 * 1.026 = 1.539rem.
    expect(out.xl).toBe("1.539rem");
  });

  it("applies headingScale ONLY to heading buckets", () => {
    const out = computeFontSizes(BASE, "regular", 0, 2);
    // Body buckets (xs, sm, base, lg) stay identical to the baseline.
    expect(out.xs).toBe(BASE.xs);
    expect(out.sm).toBe(BASE.sm);
    expect(out.base).toBe(BASE.base);
    expect(out.lg).toBe(BASE.lg);
    // Heading buckets (xl / 2xl / 3xl / 4xl) get 1.14x (1 + 2*0.07).
    // 1.5 * 1.14 = 1.71rem.
    expect(out.xl).toBe("1.71rem");
    // 3.5 * 1.14 = 3.99rem.
    expect(out["4xl"]).toBe("3.99rem");
  });

  it("composes all three knobs: scale × adjust × headingScale for heading buckets", () => {
    // Spacious (1.1) × +1 adjust (1.07) × -1 heading (0.93) for heading
    // buckets. 4xl = 3.5 * 1.1 * 1.07 * 0.93 ≈ 3.8313 → 3.831rem (rounded to
    // 3 decimals).
    const out = computeFontSizes(BASE, "spacious", 1, -1);
    expect(out["4xl"]).toBe("3.831rem");
    // Body-only bucket: 1 * 1.1 * 1.07 = 1.177rem.
    expect(out.base).toBe("1.177rem");
  });

  it("rounds output to 3 decimal places", () => {
    const out = computeFontSizes({ odd: "0.123456rem" }, "spacious", 1, 0);
    // 0.123456 * 1.1 * 1.07 = 0.14530…rem → 0.145rem.
    expect(out.odd).toBe("0.145rem");
  });

  it("preserves non-rem values verbatim", () => {
    // A theme.json that ships a bucket in px (or a calc()) shouldn't crash
    // the helper — we pass it through unchanged rather than producing NaN.
    const out = computeFontSizes(
      { base: "16px", pxBucket: "calc(1rem + 2px)" },
      "spacious",
      0,
      0,
    );
    expect(out.base).toBe("16px");
    expect(out.pxBucket).toBe("calc(1rem + 2px)");
  });

  it("returns the same keys as the input map (no additions, no drops)", () => {
    const out = computeFontSizes(BASE, "compact", 1, -1);
    expect(Object.keys(out).sort()).toEqual(Object.keys(BASE).sort());
  });

  it("covers all canonical FONT_SIZE_KEYS", () => {
    // Sanity check: the baseline scale has every canonical key represented.
    for (const key of FONT_SIZE_KEYS) {
      expect(BASE).toHaveProperty(key);
    }
  });
});

describe("FONT_SIZE_SCALE_MULTIPLIERS", () => {
  it("has an identity (1.0) multiplier for regular", () => {
    expect(FONT_SIZE_SCALE_MULTIPLIERS.regular).toBe(1);
  });

  it("compacts below 1.0 and spacious above 1.0", () => {
    expect(FONT_SIZE_SCALE_MULTIPLIERS.compact).toBeLessThan(1);
    expect(FONT_SIZE_SCALE_MULTIPLIERS.spacious).toBeGreaterThan(1);
  });
});

describe("SIZE_ADJUSTMENT_MULTIPLIER", () => {
  it("returns identity at 0 steps", () => {
    expect(SIZE_ADJUSTMENT_MULTIPLIER(0)).toBe(1);
  });

  it("is symmetric around 0 (±1 step)", () => {
    expect(SIZE_ADJUSTMENT_MULTIPLIER(1)).toBeCloseTo(1.07);
    expect(SIZE_ADJUSTMENT_MULTIPLIER(-1)).toBeCloseTo(0.93);
  });

  it("scales linearly with step count", () => {
    expect(SIZE_ADJUSTMENT_MULTIPLIER(2)).toBeCloseTo(1.14);
    expect(SIZE_ADJUSTMENT_MULTIPLIER(-2)).toBeCloseTo(0.86);
  });
});

describe("HEADING_FONT_SIZE_KEYS", () => {
  it("contains only the heading-tier buckets (xl / 2xl / 3xl / 4xl)", () => {
    expect(HEADING_FONT_SIZE_KEYS.has("xl")).toBe(true);
    expect(HEADING_FONT_SIZE_KEYS.has("2xl")).toBe(true);
    expect(HEADING_FONT_SIZE_KEYS.has("3xl")).toBe(true);
    expect(HEADING_FONT_SIZE_KEYS.has("4xl")).toBe(true);
  });

  it("excludes body-tier buckets (xs / sm / base / lg)", () => {
    expect(HEADING_FONT_SIZE_KEYS.has("xs")).toBe(false);
    expect(HEADING_FONT_SIZE_KEYS.has("sm")).toBe(false);
    expect(HEADING_FONT_SIZE_KEYS.has("base")).toBe(false);
    expect(HEADING_FONT_SIZE_KEYS.has("lg")).toBe(false);
  });
});
