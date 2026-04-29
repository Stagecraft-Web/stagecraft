import { describe, it, expect } from "vitest";
import { appearanceSchema } from "../../../lib/schemas";
import { buildCommitMessage, serializeAppearanceForKeystatic } from "../serialize";
import type { AppearanceState } from "../types";

const splitState: AppearanceState = {
  colors: {
    primary: "#1a1a2e",
    secondary: "#b91c4a",
    accent: "#0f3460",
    // In the post-transform runtime state, linkColor is never null — it's
    // either the user's override or the fallback to accent. Round-trip tests
    // below verify this relationship survives serialize → parse.
    linkColor: "#0f3460",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    border: "#7c828b",
  },
  typography: {
    mode: "split",
    primary: { category: "sans-serif", family: "Inter" },
    heading: { category: "serif", family: "Merriweather" },
    bodySizes: { xs: 0, sm: 0, base: 0, lg: 0 },
    bodyWeights: { body: 400, bodyBold: 700 },
    headingSizes: { xl: 0, "2xl": 0, "3xl": 0, "4xl": 0 },
    headingWeights: { h1: 700, h2: 700, h3: 700, h4: 700 },
  },
  siteTitleSize: 0,
};

const singleState: AppearanceState = {
  ...splitState,
  typography: {
    ...splitState.typography,
    mode: "single",
    heading: null,
  },
};

describe("serializeAppearanceForKeystatic", () => {
  it("writes the split-mode Keystatic format correctly", () => {
    const json = serializeAppearanceForKeystatic(splitState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.primary).toEqual({ discriminant: "sans-serif", value: "Inter" });
    expect(parsed.typography.heading).toEqual({
      discriminant: false,
      value: { discriminant: "serif", value: "Merriweather" },
    });
  });

  it("writes the single-mode Keystatic format correctly", () => {
    const json = serializeAppearanceForKeystatic(singleState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.heading).toEqual({ discriminant: true, value: null });
  });

  it("serialises body and heading weights as strings (matching Keystatic's select output)", () => {
    const json = serializeAppearanceForKeystatic(splitState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.bodyWeights.body).toBe("400");
    expect(parsed.typography.bodyWeights.bodyBold).toBe("700");
    expect(parsed.typography.headingWeights.h1).toBe("700");
    expect(parsed.typography.headingWeights.h4).toBe("700");
  });

  it("does not surface h5 or h6 weights in the serialised output", () => {
    // h5/h6 weights are intentionally not part of the Appearance schema —
    // global.css's @layer defaults provides their values. The serialiser
    // should never write those keys back into appearance.json.
    const json = serializeAppearanceForKeystatic(splitState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.headingWeights).not.toHaveProperty("h5");
    expect(parsed.typography.headingWeights).not.toHaveProperty("h6");
    expect(parsed.typography.bodyWeights).not.toHaveProperty("h5");
  });

  it("ends with a trailing newline (matches Keystatic UI's output)", () => {
    const json = serializeAppearanceForKeystatic(splitState);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("round-trips through appearanceSchema back to the same runtime shape", () => {
    // Writing then re-reading the JSON must produce an equivalent state —
    // otherwise commits from the sidebar would "see" a change on read.
    const json = serializeAppearanceForKeystatic(splitState);
    const parsed = appearanceSchema.parse(JSON.parse(json));
    expect(parsed).toEqual(splitState);
  });

  it("round-trips single mode correctly", () => {
    const json = serializeAppearanceForKeystatic(singleState);
    const parsed = appearanceSchema.parse(JSON.parse(json));
    expect(parsed).toEqual(singleState);
  });

  // Per-bucket size blocks — must persist as integer pixels and round-trip
  // cleanly. `0` is the "use baseline" sentinel.
  it("writes bodySizes / headingSizes blocks with explicit per-bucket px entries", () => {
    const json = serializeAppearanceForKeystatic({
      ...splitState,
      typography: {
        ...splitState.typography,
        bodySizes: { xs: 11, sm: 0, base: 18, lg: 0 },
        headingSizes: { xl: 26, "2xl": 0, "3xl": 0, "4xl": 64 },
      },
    });
    const parsed = JSON.parse(json);
    expect(parsed.typography.bodySizes).toEqual({
      xs: 11,
      sm: 0,
      base: 18,
      lg: 0,
    });
    expect(parsed.typography.headingSizes).toEqual({
      xl: 26,
      "2xl": 0,
      "3xl": 0,
      "4xl": 64,
    });
  });

  it("round-trips a state with per-bucket px overrides through the schema", () => {
    const state: AppearanceState = {
      ...splitState,
      typography: {
        ...splitState.typography,
        bodySizes: { xs: 11, sm: 0, base: 18, lg: 0 },
        headingSizes: { xl: 26, "2xl": 0, "3xl": 0, "4xl": 64 },
      },
    };
    const json = serializeAppearanceForKeystatic(state);
    const parsed = appearanceSchema.parse(JSON.parse(json));
    expect(parsed).toEqual(state);
  });
});

describe("buildCommitMessage", () => {
  it("falls back to 'Update appearance' when nothing changed", () => {
    const msg = buildCommitMessage(splitState, splitState);
    expect(msg.headline).toBe("Update appearance");
  });

  it("names single changes in the headline", () => {
    const next: AppearanceState = {
      ...splitState,
      colors: { ...splitState.colors, primary: "#333" },
    };
    const { headline, body } = buildCommitMessage(splitState, next);
    expect(headline).toBe("Update appearance: primary color");
    expect(body).toContain("primary color: #1a1a2e → #333");
  });

  it("lists multiple changes with 'and N more' when exceeding 3", () => {
    const next: AppearanceState = {
      ...splitState,
      colors: {
        ...splitState.colors,
        primary: "#333",
        secondary: "#444",
        accent: "#555",
        background: "#666",
      },
    };
    const { headline } = buildCommitMessage(splitState, next);
    expect(headline).toMatch(/and \d+ more/);
  });

  it("describes a mode change as 'font strategy'", () => {
    const { headline, body } = buildCommitMessage(splitState, singleState);
    expect(headline).toContain("font strategy");
    expect(body).toContain("font strategy: split → single");
    expect(body).toContain("heading font: Merriweather → (same as body)");
  });

  it("describes a heading-weight change as e.g. 'h2 weight'", () => {
    const next: AppearanceState = {
      ...splitState,
      typography: {
        ...splitState.typography,
        headingWeights: { ...splitState.typography.headingWeights, h2: 500 },
      },
    };
    const { headline, body } = buildCommitMessage(splitState, next);
    expect(headline).toContain("h2 weight");
    expect(body).toContain("h2 weight: 700 → 500");
  });

  it("describes a body-bucket size change as e.g. 'base size'", () => {
    const next: AppearanceState = {
      ...splitState,
      typography: {
        ...splitState.typography,
        bodySizes: { ...splitState.typography.bodySizes, base: 18 },
      },
    };
    const { headline, body } = buildCommitMessage(splitState, next);
    expect(headline).toContain("base size");
    expect(body).toContain("base size: (default) → 1.125rem");
  });

  it("describes a heading-bucket size change as e.g. '4xl size'", () => {
    const next: AppearanceState = {
      ...splitState,
      typography: {
        ...splitState.typography,
        headingSizes: { ...splitState.typography.headingSizes, "4xl": 64 },
      },
    };
    const { headline, body } = buildCommitMessage(splitState, next);
    expect(headline).toContain("4xl size");
    expect(body).toContain("4xl size: (default) → 4rem");
  });
});
