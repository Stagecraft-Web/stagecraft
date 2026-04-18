import { describe, expect, it } from "vitest";
import { parseColumnsLayout } from "./keystatic-previews";

describe("parseColumnsLayout", () => {
  it("returns the default 1fr 1fr when input is missing or blank", () => {
    expect(parseColumnsLayout(undefined)).toBe("1fr 1fr");
    expect(parseColumnsLayout(null)).toBe("1fr 1fr");
    expect(parseColumnsLayout("")).toBe("1fr 1fr");
    expect(parseColumnsLayout("   ")).toBe("1fr 1fr");
  });

  it("parses equal two-column layouts", () => {
    expect(parseColumnsLayout("1-1")).toBe("1fr 1fr");
  });

  it("parses asymmetric two-column layouts", () => {
    expect(parseColumnsLayout("1-2")).toBe("1fr 2fr");
    expect(parseColumnsLayout("2-1")).toBe("2fr 1fr");
    expect(parseColumnsLayout("1-3")).toBe("1fr 3fr");
  });

  it("parses three-column layouts", () => {
    expect(parseColumnsLayout("1-1-1")).toBe("1fr 1fr 1fr");
    expect(parseColumnsLayout("2-1-1")).toBe("2fr 1fr 1fr");
  });

  it("drops non-positive and non-numeric tracks", () => {
    expect(parseColumnsLayout("1-0-2")).toBe("1fr 2fr");
    expect(parseColumnsLayout("1-abc-2")).toBe("1fr 2fr");
  });

  it("falls back when every track is invalid", () => {
    expect(parseColumnsLayout("abc")).toBe("1fr 1fr");
    expect(parseColumnsLayout("0-0")).toBe("1fr 1fr");
    expect(parseColumnsLayout("-")).toBe("1fr 1fr");
  });

  it("trims whitespace around the input", () => {
    expect(parseColumnsLayout("  1-2  ")).toBe("1fr 2fr");
  });
});
