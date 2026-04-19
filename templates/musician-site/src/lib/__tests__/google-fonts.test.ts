import { describe, it, expect } from "vitest";
import {
  buildGoogleFontsUrl,
  buildFontStack,
  appearanceToFontRequests,
  GOOGLE_FONTS,
} from "../google-fonts";

describe("buildGoogleFontsUrl", () => {
  it("returns null when no families are given", () => {
    expect(buildGoogleFontsUrl([])).toBeNull();
  });

  it("returns null when all families are empty strings", () => {
    expect(buildGoogleFontsUrl([{ family: "", weights: [400] }])).toBeNull();
  });

  it("returns null when a family has no weights", () => {
    expect(buildGoogleFontsUrl([{ family: "Inter", weights: [] }])).toBeNull();
  });

  it("builds a URL for a single family with a single weight", () => {
    const url = buildGoogleFontsUrl([{ family: "Inter", weights: [400] }]);
    expect(url).toBe("https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap");
  });

  it("sorts and dedupes weights", () => {
    const url = buildGoogleFontsUrl([{ family: "Inter", weights: [700, 400, 400, 600] }]);
    expect(url).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
    );
  });

  it("joins multiple families with &family=", () => {
    const url = buildGoogleFontsUrl([
      { family: "Inter", weights: [400, 700] },
      { family: "Merriweather", weights: [700] },
    ]);
    expect(url).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Merriweather:wght@700&display=swap",
    );
  });

  it("encodes multi-word family names with + separators", () => {
    const url = buildGoogleFontsUrl([{ family: "Plus Jakarta Sans", weights: [400] }]);
    expect(url).toBe(
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400&display=swap",
    );
  });

  it("skips empty families but keeps valid siblings", () => {
    const url = buildGoogleFontsUrl([
      { family: "", weights: [400] },
      { family: "Inter", weights: [400] },
    ]);
    expect(url).toBe("https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap");
  });
});

describe("buildFontStack", () => {
  it("uses the known fallback for a curated family", () => {
    expect(buildFontStack("Inter")).toBe("Inter, sans-serif");
    expect(buildFontStack("Merriweather")).toBe("Merriweather, serif");
    expect(buildFontStack("JetBrains Mono")).toBe('"JetBrains Mono", monospace');
  });

  it("quotes multi-word family names", () => {
    expect(buildFontStack("Plus Jakarta Sans")).toBe('"Plus Jakarta Sans", sans-serif');
  });

  it("falls back by category for unknown (custom) families", () => {
    expect(buildFontStack("My Brand Font", "serif")).toBe('"My Brand Font", serif');
    expect(buildFontStack("My Brand Font", "monospace")).toBe('"My Brand Font", monospace');
    expect(buildFontStack("My Brand Font", "handwriting")).toBe('"My Brand Font", cursive');
  });

  it("defaults unknown-no-category to sans-serif", () => {
    expect(buildFontStack("My Brand Font")).toBe('"My Brand Font", sans-serif');
  });
});

describe("appearanceToFontRequests", () => {
  const weights = {
    body: 400,
    bodyBold: 700,
    h1: 700,
    h2: 600,
    h3: 600,
    h4: 500,
    h5: 500,
    h6: 500,
  };

  it("returns a single request when mode is 'single'", () => {
    const requests = appearanceToFontRequests({
      typography: {
        mode: "single",
        primary: { family: "Inter" },
        heading: { family: "Merriweather" }, // ignored
        weights,
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].family).toBe("Inter");
    expect(requests[0].weights).toEqual(expect.arrayContaining([400, 500, 600, 700]));
  });

  it("returns two requests when mode is 'split' with distinct families", () => {
    const requests = appearanceToFontRequests({
      typography: {
        mode: "split",
        primary: { family: "Inter" },
        heading: { family: "Merriweather" },
        weights,
      },
    });
    expect(requests).toHaveLength(2);
    const inter = requests.find((r) => r.family === "Inter");
    const merri = requests.find((r) => r.family === "Merriweather");
    expect(inter?.weights).toEqual([400, 700]);
    expect(merri?.weights).toEqual([700, 600, 600, 500, 500, 500]);
  });

  it("collapses to one request when split mode picks the same family", () => {
    const requests = appearanceToFontRequests({
      typography: {
        mode: "split",
        primary: { family: "Inter" },
        heading: { family: "Inter" },
        weights,
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].family).toBe("Inter");
  });
});

describe("GOOGLE_FONTS catalogue", () => {
  it("has entries in every category", () => {
    for (const category of Object.keys(GOOGLE_FONTS) as (keyof typeof GOOGLE_FONTS)[]) {
      expect(GOOGLE_FONTS[category].length).toBeGreaterThan(0);
    }
  });

  it("pins Inter in sans-serif and Merriweather in serif (widely-used defaults)", () => {
    expect(GOOGLE_FONTS["sans-serif"].some((f) => f.family === "Inter")).toBe(true);
    expect(GOOGLE_FONTS.serif.some((f) => f.family === "Merriweather")).toBe(true);
  });
});
