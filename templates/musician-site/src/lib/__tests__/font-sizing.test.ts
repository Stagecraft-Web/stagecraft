import { describe, it, expect } from "vitest";
import { FONT_SIZE_KEYS, computeFontSizes, pxToRem } from "../font-sizing";

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

describe("pxToRem", () => {
  it("converts using the 16px-per-rem convention", () => {
    expect(pxToRem(16)).toBe("1rem");
    expect(pxToRem(8)).toBe("0.5rem");
    expect(pxToRem(18)).toBe("1.125rem");
    expect(pxToRem(96)).toBe("6rem");
  });

  it("rounds to 3 decimals", () => {
    // 17px / 16 = 1.0625rem (exact)
    expect(pxToRem(17)).toBe("1.063rem");
  });
});

describe("computeFontSizes", () => {
  it("returns the baseline verbatim when no overrides are supplied", () => {
    // Identity invariant: empty override maps → output equals input
    // byte-for-byte. Sites that don't touch the size controls render
    // identically to a site whose appearance.json carries no size block.
    const out = computeFontSizes(BASE);
    expect(out).toEqual(BASE);
  });

  it("treats `0` overrides as 'use the baseline'", () => {
    const out = computeFontSizes(BASE, { base: 0 }, { xl: 0 });
    expect(out.base).toBe(BASE.base);
    expect(out.xl).toBe(BASE.xl);
  });

  it("applies a body-bucket override, converting px → rem", () => {
    const out = computeFontSizes(BASE, { base: 18, lg: 22 });
    expect(out.base).toBe("1.125rem"); // 18 / 16
    expect(out.lg).toBe("1.375rem"); // 22 / 16
    // Other buckets fall through.
    expect(out.xs).toBe(BASE.xs);
    expect(out["4xl"]).toBe(BASE["4xl"]);
  });

  it("applies a heading-bucket override", () => {
    const out = computeFontSizes(BASE, {}, { "4xl": 64, xl: 26 });
    expect(out["4xl"]).toBe("4rem"); // 64 / 16
    expect(out.xl).toBe("1.625rem"); // 26 / 16
    // Body buckets unchanged.
    expect(out.base).toBe(BASE.base);
  });

  it("composes body + heading override maps without ambiguity", () => {
    // Body and heading maps target disjoint buckets in normal use, but the
    // implementation preferring `bodyOverrides` first is documented behavior:
    // a value present in both wins from `bodyOverrides`.
    const out = computeFontSizes(
      BASE,
      { base: 18 },
      { xl: 28, "4xl": 64 },
    );
    expect(out.base).toBe("1.125rem");
    expect(out.xl).toBe("1.75rem");
    expect(out["4xl"]).toBe("4rem");
  });

  it("returns the same keys as the input map (no additions, no drops)", () => {
    const out = computeFontSizes(BASE, { base: 18 });
    expect(Object.keys(out).sort()).toEqual(Object.keys(BASE).sort());
  });

  it("preserves non-rem baseline values verbatim when no override is set", () => {
    // Baselines in px or calc() shouldn't be mangled by this helper — they
    // pass through unchanged when no override applies.
    const out = computeFontSizes(
      { base: "16px", weird: "calc(1rem + 2px)" },
      {},
      {},
    );
    expect(out.base).toBe("16px");
    expect(out.weird).toBe("calc(1rem + 2px)");
  });

  it("covers all canonical FONT_SIZE_KEYS", () => {
    // Sanity check: the baseline scale has every canonical key represented.
    for (const key of FONT_SIZE_KEYS) {
      expect(BASE).toHaveProperty(key);
    }
  });
});
