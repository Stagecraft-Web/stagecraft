import { describe, it, expect } from "vitest";
import { FONT_SIZE_KEYS, computeFontSizes } from "../font-sizing";

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
  it("returns the baseline verbatim when no overrides are supplied", () => {
    // Identity invariant: empty override maps → output equals input
    // byte-for-byte. Sites that don't touch the size controls render
    // identically to a site whose appearance.json carries no size block.
    const out = computeFontSizes(BASE);
    expect(out).toEqual(BASE);
  });

  it("treats empty-string overrides as 'use the baseline'", () => {
    const out = computeFontSizes(BASE, { base: "" }, { xl: "" });
    expect(out.base).toBe(BASE.base);
    expect(out.xl).toBe(BASE.xl);
  });

  it("treats whitespace-only overrides as 'use the baseline'", () => {
    const out = computeFontSizes(BASE, { base: "   " });
    expect(out.base).toBe(BASE.base);
  });

  it("applies a body-bucket override when set", () => {
    const out = computeFontSizes(BASE, { base: "1.125rem", lg: "1.375rem" });
    expect(out.base).toBe("1.125rem");
    expect(out.lg).toBe("1.375rem");
    // Other buckets fall through.
    expect(out.xs).toBe(BASE.xs);
    expect(out["4xl"]).toBe(BASE["4xl"]);
  });

  it("applies a heading-bucket override when set", () => {
    const out = computeFontSizes(BASE, {}, { "4xl": "4rem", xl: "1.625rem" });
    expect(out["4xl"]).toBe("4rem");
    expect(out.xl).toBe("1.625rem");
    // Body buckets unchanged.
    expect(out.base).toBe(BASE.base);
  });

  it("composes body + heading override maps without ambiguity", () => {
    // Body and heading maps target disjoint buckets in normal use, but the
    // implementation preferring `bodyOverrides` first is documented behavior:
    // a value present in both wins from `bodyOverrides`.
    const out = computeFontSizes(
      BASE,
      { base: "1.1rem" },
      { xl: "1.75rem", "4xl": "4rem" },
    );
    expect(out.base).toBe("1.1rem");
    expect(out.xl).toBe("1.75rem");
    expect(out["4xl"]).toBe("4rem");
  });

  it("returns the same keys as the input map (no additions, no drops)", () => {
    const out = computeFontSizes(BASE, { base: "1.125rem" });
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
