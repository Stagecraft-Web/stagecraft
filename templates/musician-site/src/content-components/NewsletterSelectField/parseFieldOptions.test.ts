import { describe, expect, it } from "vitest";
import { parseFieldOptions } from "./parseFieldOptions";

describe("parseFieldOptions", () => {
  it("returns an empty array for blank / nullish input", () => {
    expect(parseFieldOptions(undefined)).toEqual([]);
    expect(parseFieldOptions(null)).toEqual([]);
    expect(parseFieldOptions("")).toEqual([]);
    expect(parseFieldOptions("   ")).toEqual([]);
  });

  it("splits a simple pipe-separated list", () => {
    expect(parseFieldOptions("Friend|Social|Other")).toEqual([
      "Friend",
      "Social",
      "Other",
    ]);
  });

  it("trims whitespace around each choice", () => {
    expect(parseFieldOptions("  Friend |  Social|Other ")).toEqual([
      "Friend",
      "Social",
      "Other",
    ]);
  });

  it("drops empty segments from trailing, leading, or double pipes", () => {
    expect(parseFieldOptions("|Friend|Social|")).toEqual(["Friend", "Social"]);
    expect(parseFieldOptions("Friend||Social")).toEqual(["Friend", "Social"]);
    expect(parseFieldOptions("|||")).toEqual([]);
  });

  it("returns a single-element list when there are no pipes", () => {
    expect(parseFieldOptions("Only one")).toEqual(["Only one"]);
  });

  it("preserves inner whitespace inside each choice (only trims edges)", () => {
    expect(parseFieldOptions("New York|San Francisco")).toEqual([
      "New York",
      "San Francisco",
    ]);
  });

  it("ignores non-string input types", () => {
    // @ts-expect-error — runtime guard for non-string inputs
    expect(parseFieldOptions(42)).toEqual([]);
    // @ts-expect-error — runtime guard for non-string inputs
    expect(parseFieldOptions(["A", "B"])).toEqual([]);
  });
});
