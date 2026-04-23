import { describe, expect, it } from "vitest";
import { nextIndex, prevIndex, clampIndex } from "./indexMath";

describe("nextIndex", () => {
  it("advances by one within range", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
  });

  it("wraps from the last slide back to 0", () => {
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(9, 10)).toBe(0);
  });

  it("stays at 0 for an empty slide array", () => {
    expect(nextIndex(0, 0)).toBe(0);
    // Even if the caller somehow has a stale current index, we don't throw.
    expect(nextIndex(5, 0)).toBe(0);
  });

  it("handles a single-slide carousel (next === current)", () => {
    expect(nextIndex(0, 1)).toBe(0);
  });
});

describe("prevIndex", () => {
  it("steps back by one within range", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(1, 3)).toBe(0);
  });

  it("wraps from 0 back to the last slide", () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(0, 10)).toBe(9);
  });

  it("stays at 0 for an empty slide array", () => {
    expect(prevIndex(0, 0)).toBe(0);
    expect(prevIndex(5, 0)).toBe(0);
  });

  it("handles a single-slide carousel (prev === current)", () => {
    expect(prevIndex(0, 1)).toBe(0);
  });
});

describe("clampIndex", () => {
  it("returns the index unchanged when in range", () => {
    expect(clampIndex(0, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(2, 3)).toBe(2);
  });

  it("clamps negative indices to 0", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(-100, 3)).toBe(0);
  });

  it("clamps out-of-range indices to length - 1", () => {
    expect(clampIndex(3, 3)).toBe(2);
    expect(clampIndex(100, 3)).toBe(2);
  });

  it("stays at 0 for an empty slide array", () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(5, 0)).toBe(0);
    expect(clampIndex(-5, 0)).toBe(0);
  });

  it("treats non-finite inputs as 0", () => {
    expect(clampIndex(Number.NaN, 3)).toBe(0);
    expect(clampIndex(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(clampIndex(Number.NEGATIVE_INFINITY, 3)).toBe(0);
  });

  it("floors fractional indices so keyboard math can't land off-slide", () => {
    expect(clampIndex(1.9, 3)).toBe(1);
    expect(clampIndex(0.1, 3)).toBe(0);
  });
});
