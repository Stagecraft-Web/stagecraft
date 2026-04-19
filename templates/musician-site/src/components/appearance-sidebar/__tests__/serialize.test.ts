import { describe, it, expect } from "vitest";
import { appearanceSchema } from "../../../lib/schemas";
import { buildCommitMessage, serializeAppearanceForKeystatic } from "../serialize";
import type { AppearanceState } from "../types";

const splitState: AppearanceState = {
  colors: {
    primary: "#1a1a2e",
    secondary: "#e94560",
    accent: "#0f3460",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    border: "#e5e7eb",
  },
  typography: {
    mode: "split",
    primary: { category: "sans-serif", family: "Inter" },
    heading: { category: "serif", family: "Merriweather" },
    weights: { body: 400, bodyBold: 700, h1: 700, h2: 700, h3: 700, h4: 700, h5: 600, h6: 600 },
  },
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
      discriminant: "split",
      value: { discriminant: "serif", value: "Merriweather" },
    });
  });

  it("writes the single-mode Keystatic format correctly", () => {
    const json = serializeAppearanceForKeystatic(singleState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.heading).toEqual({ discriminant: "single", value: null });
  });

  it("serialises weights as strings (matching Keystatic's select output)", () => {
    const json = serializeAppearanceForKeystatic(splitState);
    const parsed = JSON.parse(json);
    expect(parsed.typography.weights.body).toBe("400");
    expect(parsed.typography.weights.h5).toBe("600");
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

  it("describes a weight change as e.g. 'h2 weight'", () => {
    const next: AppearanceState = {
      ...splitState,
      typography: {
        ...splitState.typography,
        weights: { ...splitState.typography.weights, h2: 500 },
      },
    };
    const { headline, body } = buildCommitMessage(splitState, next);
    expect(headline).toContain("h2 weight");
    expect(body).toContain("h2 weight: 700 → 500");
  });
});
