import { describe, it, expect } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Cool Band")).toBe("my-cool-band");
  });

  it("strips special characters", () => {
    expect(slugify("Jón & The Waves!")).toBe("j-n-the-waves");
  });

  it("collapses multiple separators", () => {
    expect(slugify("too   many   spaces")).toBe("too-many-spaces");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("  spaced  ")).toBe("spaced");
  });

  it("handles single words", () => {
    expect(slugify("Artist")).toBe("artist");
  });

  it("handles numbers", () => {
    expect(slugify("Blink 182")).toBe("blink-182");
  });
});
