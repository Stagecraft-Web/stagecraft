import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeFilename, VALID_USAGE_SLOTS, USAGE_SLOTS } from "../assets";

describe("normalizeFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lowercases and replaces special chars with hyphens", () => {
    const result = normalizeFilename("My Photo 2024.jpg");
    expect(result).toBe("my-photo-2024-1705320000000.jpg");
  });

  it("preserves extension in lowercase", () => {
    expect(normalizeFilename("image.PNG")).toMatch(/\.png$/);
    expect(normalizeFilename("logo.SVG")).toMatch(/\.svg$/);
  });

  it("handles files with no extension", () => {
    const result = normalizeFilename("myfile");
    expect(result).toBe("myfile-1705320000000");
    expect(result).not.toContain(".");
  });

  it("strips leading and trailing hyphens from the base", () => {
    const result = normalizeFilename("---photo---.jpg");
    // Leading/trailing hyphens removed → base is "photo"
    expect(result).toMatch(/^photo-\d+\.jpg$/);
  });

  it("truncates base to 60 characters", () => {
    const longName = "a".repeat(80) + ".jpg";
    const result = normalizeFilename(longName);
    const base = result.replace(/-\d+\.jpg$/, "");
    expect(base.length).toBeLessThanOrEqual(60);
  });

  it("collapses multiple special chars into a single hyphen", () => {
    const result = normalizeFilename("hello   world!!!photo.jpg");
    expect(result).toMatch(/^hello-world-photo-/);
  });

  it("handles filenames with multiple dots", () => {
    const result = normalizeFilename("my.band.logo.png");
    expect(result).toMatch(/^my-band-logo-\d+\.png$/);
  });
});

describe("VALID_USAGE_SLOTS", () => {
  it("contains all slot values from USAGE_SLOTS", () => {
    for (const slot of USAGE_SLOTS) {
      expect(VALID_USAGE_SLOTS.has(slot.value)).toBe(true);
    }
  });

  it('includes "" for unassigned', () => {
    expect(VALID_USAGE_SLOTS.has("")).toBe(true);
  });

  it("rejects unknown slot values", () => {
    expect(VALID_USAGE_SLOTS.has("unknown")).toBe(false);
    expect(VALID_USAGE_SLOTS.has("thumbnail")).toBe(false);
  });
});
