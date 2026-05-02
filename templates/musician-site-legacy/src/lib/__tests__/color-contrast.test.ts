import { describe, expect, it } from "vitest";
import {
  CONTRAST_PAIRS,
  REQUIRED_RATIOS,
  checkContrast,
  getContrastRatio,
  parseColor,
  relativeLuminance,
  resolveColorRef,
  type AppearanceColors,
} from "../color-contrast";

// ---- Seed palette — must mirror src/content/config/appearance.json after the
//      accent/secondary adjustments. The whole point of the sanity check below
//      is that the default seed never regresses contrast-wise, so we inline
//      the values here rather than reading the JSON file at test time (that
//      would hide a drift between file and test).
const SEED_COLORS: AppearanceColors = {
  primary: "#1a1a2e",
  secondary: "#b91c4a",
  accent: "#0f3460",
  linkColor: "#0f3460", // post-transform: empty string falls back to accent
  background: "#fafafa",
  surface: "#ffffff",
  text: "#1a1a2e",
  textMuted: "#6b7280",
  border: "#7c828b",
};

describe("parseColor", () => {
  it("parses 3-digit hex", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("parses 6-digit hex (case-insensitive)", () => {
    expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#FF00AA")).toEqual({ r: 255, g: 0, b: 170 });
    expect(parseColor("#1a1a2e")).toEqual({ r: 26, g: 26, b: 46 });
  });

  it("parses 8-digit hex (alpha is dropped)", () => {
    expect(parseColor("#ff00aaff")).toEqual({ r: 255, g: 0, b: 170 });
    expect(parseColor("#abcdef99")).toEqual({ r: 171, g: 205, b: 239 });
  });

  it("parses rgb()/rgba() with comma separators", () => {
    expect(parseColor("rgb(255, 0, 128)")).toEqual({ r: 255, g: 0, b: 128 });
    expect(parseColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("parses rgb() with percentage channels", () => {
    expect(parseColor("rgb(100%, 0%, 50%)")).toEqual({ r: 255, g: 0, b: 128 });
  });

  it("returns null for unparseable strings", () => {
    expect(parseColor("hotpink")).toBeNull();
    expect(parseColor("hsl(200, 50%, 50%)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("not a color")).toBeNull();
    expect(parseColor("#gggggg")).toBeNull();
    expect(parseColor("#1234")).toBeNull();
  });

  it("trims leading/trailing whitespace", () => {
    expect(parseColor("  #fff  ")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("relativeLuminance", () => {
  const EPSILON = 1e-6;

  it("returns 1 for pure white", () => {
    expect(Math.abs(relativeLuminance({ r: 255, g: 255, b: 255 }) - 1)).toBeLessThan(EPSILON);
  });

  it("returns 0 for pure black", () => {
    expect(Math.abs(relativeLuminance({ r: 0, g: 0, b: 0 }))).toBeLessThan(EPSILON);
  });

  it("returns a value between 0 and 1 for intermediate grays", () => {
    const mid = relativeLuminance({ r: 128, g: 128, b: 128 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("weights green more than red or blue (WCAG coefficients)", () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("getContrastRatio", () => {
  it("returns ~21 for black vs white", () => {
    const ratio = getContrastRatio("#000000", "#ffffff");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("is symmetric — order doesn't matter", () => {
    const a = getContrastRatio("#000000", "#ffffff");
    const b = getContrastRatio("#ffffff", "#000000");
    expect(a).toBeCloseTo(b, 10);
  });

  it("returns 1 for identical colors", () => {
    expect(getContrastRatio("#777777", "#777777")).toBeCloseTo(1, 6);
  });

  it("is always >= 1", () => {
    // Sample several color pairs — the formula's max/min guarantees this.
    const samples = [
      ["#123", "#abc"],
      ["#ffffff", "#888888"],
      ["rgb(10,20,30)", "rgb(200,200,50)"],
    ];
    for (const [fg, bg] of samples) {
      expect(getContrastRatio(fg, bg)).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns NaN when either input is unparseable", () => {
    expect(Number.isNaN(getContrastRatio("hotpink", "#000"))).toBe(true);
    expect(Number.isNaN(getContrastRatio("#000", "nope"))).toBe(true);
    expect(Number.isNaN(getContrastRatio("", ""))).toBe(true);
  });
});

describe("resolveColorRef", () => {
  it("dereferences key refs against the colors object", () => {
    expect(resolveColorRef({ key: "text" }, SEED_COLORS)).toBe(SEED_COLORS.text);
    expect(resolveColorRef({ key: "background" }, SEED_COLORS)).toBe(SEED_COLORS.background);
  });

  it("returns literal refs unchanged", () => {
    expect(resolveColorRef({ literal: "#ffffff" }, SEED_COLORS)).toBe("#ffffff");
  });
});

describe("CONTRAST_PAIRS", () => {
  it("enumerates all 10 documented pairs", () => {
    expect(CONTRAST_PAIRS).toHaveLength(10);
  });

  it("every pair references only known AppearanceColorKey values on non-literal refs", () => {
    const knownKeys = new Set<string>(Object.keys(SEED_COLORS));
    for (const { fg, bg } of CONTRAST_PAIRS) {
      if ("key" in fg) expect(knownKeys.has(fg.key)).toBe(true);
      if ("key" in bg) expect(knownKeys.has(bg.key)).toBe(true);
    }
  });

  it("every pair specifies a valid level", () => {
    for (const pair of CONTRAST_PAIRS) {
      expect(["AA", "AA-large"]).toContain(pair.level);
    }
  });
});

describe("checkContrast — seed palette", () => {
  // This is the "nothing regresses" guard. If anyone touches the seed colors
  // without fixing the pair list, this blows up — exactly the friction the
  // product spec calls for.
  it("every pair passes the default seed palette", () => {
    const results = checkContrast(SEED_COLORS);
    const failures = results.filter((r) => !r.passes);
    const failureMessages = failures.map(
      (f) =>
        `${f.pair.label}: ${Number.isFinite(f.ratio) ? f.ratio.toFixed(2) : "NaN"}:1, needs ${f.required}:1`,
    );
    expect(failureMessages).toEqual([]);
  });

  it("returns one result per pair", () => {
    expect(checkContrast(SEED_COLORS)).toHaveLength(CONTRAST_PAIRS.length);
  });

  it("computed ratios are symmetrical to the rule thresholds", () => {
    const results = checkContrast(SEED_COLORS);
    for (const r of results) {
      expect(r.required).toBe(REQUIRED_RATIOS[r.pair.level]);
    }
  });
});

describe("checkContrast — synthetic failing palette", () => {
  // Deliberately low-contrast: light gray text on white, invisible borders,
  // muted-text that even fails large-text threshold, and a pastel secondary
  // that can't support a white button label.
  const failingColors: AppearanceColors = {
    primary: "#cccccc",
    secondary: "#ffcccc",
    accent: "#eeeeee",
    linkColor: "#eeeeee",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#cccccc",
    textMuted: "#e0e0e0",
    border: "#f5f5f5",
  };

  it("flags body text on page", () => {
    const results = checkContrast(failingColors);
    const bodyTextOnPage = results.find((r) => r.pair.label === "Body text on page");
    expect(bodyTextOnPage?.passes).toBe(false);
  });

  it("flags muted text (which only needs AA-large / 3:1)", () => {
    const results = checkContrast(failingColors);
    const muted = results.find((r) => r.pair.label === "Muted text on page");
    expect(muted?.passes).toBe(false);
    expect(muted?.required).toBe(3);
  });

  it("flags white button label on a pastel secondary", () => {
    const results = checkContrast(failingColors);
    const btn = results.find(
      (r) => r.pair.label === "Button label (white) on secondary",
    );
    expect(btn?.passes).toBe(false);
  });

  it("flags near-invisible borders", () => {
    const results = checkContrast(failingColors);
    const borders = results.find((r) => r.pair.label === "Borders on page");
    expect(borders?.passes).toBe(false);
  });

  it("reports multiple failures, not just one", () => {
    const results = checkContrast(failingColors);
    const failures = results.filter((r) => !r.passes);
    expect(failures.length).toBeGreaterThan(3);
  });
});

describe("checkContrast — unparseable inputs", () => {
  it("treats unparseable hex as a hard fail (NaN ratio)", () => {
    const badColors: AppearanceColors = {
      ...SEED_COLORS,
      text: "not-a-color", // corrupt
    };
    const results = checkContrast(badColors);
    const bodyTextOnPage = results.find((r) => r.pair.label === "Body text on page");
    expect(bodyTextOnPage?.passes).toBe(false);
    expect(Number.isNaN(bodyTextOnPage?.ratio ?? 0)).toBe(true);
  });
});

describe("REQUIRED_RATIOS", () => {
  it("matches WCAG 2.1 thresholds", () => {
    expect(REQUIRED_RATIOS.AA).toBe(4.5);
    expect(REQUIRED_RATIOS["AA-large"]).toBe(3.0);
  });
});
