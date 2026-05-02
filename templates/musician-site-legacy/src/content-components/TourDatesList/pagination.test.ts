import { describe, expect, it } from "vitest";
import { computePageBatches, hasOverflow } from "./pagination";

describe("computePageBatches", () => {
  it("returns an empty array for empty input", () => {
    expect(computePageBatches([], 10)).toEqual([]);
  });

  it("returns a single batch when the list fits in one page", () => {
    const items = [1, 2, 3];
    expect(computePageBatches(items, 10)).toEqual([[1, 2, 3]]);
  });

  it("returns a single batch when the list exactly equals one page", () => {
    const items = [1, 2, 3, 4, 5];
    expect(computePageBatches(items, 5)).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("splits a list larger than one page into consecutive batches", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(computePageBatches(items, 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  it("splits into a final full batch when length is a multiple of pageSize", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(computePageBatches(items, 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it("clamps pageSize of 0 up to 1 (one item per batch)", () => {
    const items = [1, 2, 3];
    expect(computePageBatches(items, 0)).toEqual([[1], [2], [3]]);
  });

  it("clamps negative pageSize up to 1 (one item per batch)", () => {
    const items = [1, 2];
    expect(computePageBatches(items, -5)).toEqual([[1], [2]]);
  });

  it("floors fractional pageSize before splitting", () => {
    const items = [1, 2, 3, 4, 5];
    expect(computePageBatches(items, 2.9)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [1, 2, 3, 4, 5];
    const snapshot = [...items];
    computePageBatches(items, 2);
    expect(items).toEqual(snapshot);
  });
});

describe("hasOverflow", () => {
  it("is false when the list is empty", () => {
    expect(hasOverflow([], 10)).toBe(false);
  });

  it("is false when the list fits in one page", () => {
    expect(hasOverflow([1, 2, 3], 10)).toBe(false);
  });

  it("is false when the list exactly equals one page", () => {
    expect(hasOverflow([1, 2, 3], 3)).toBe(false);
  });

  it("is true when the list exceeds one page", () => {
    expect(hasOverflow([1, 2, 3, 4], 3)).toBe(true);
  });

  it("clamps pageSize of 0 up to 1 — any list of 2+ overflows", () => {
    expect(hasOverflow([1], 0)).toBe(false);
    expect(hasOverflow([1, 2], 0)).toBe(true);
  });

  it("floors fractional pageSize", () => {
    // 2.9 floors to 2 — a 3-item list overflows.
    expect(hasOverflow([1, 2, 3], 2.9)).toBe(true);
    expect(hasOverflow([1, 2], 2.9)).toBe(false);
  });
});
