import { describe, expect, it } from "vitest";
import {
  filterByCategory,
  type CategorizedTourDateRow,
} from "./filterTourDates";

function row(venue: string, category?: string): CategorizedTourDateRow {
  return category === undefined ? { venue } : { venue, category };
}

describe("filterByCategory", () => {
  it("returns input unchanged when categoryFilter is undefined", () => {
    const rows = [row("a", "Winter Tour"), row("b"), row("c", "Charlie Brown")];
    expect(filterByCategory(rows, undefined)).toEqual(rows);
  });

  it("returns input unchanged when categoryFilter is an empty string", () => {
    const rows = [row("a", "Winter Tour"), row("b")];
    expect(filterByCategory(rows, "")).toEqual(rows);
  });

  it("returns input unchanged when categoryFilter is whitespace-only", () => {
    const rows = [row("a", "Winter Tour"), row("b")];
    expect(filterByCategory(rows, "   ")).toEqual(rows);
  });

  it("keeps only rows whose category exactly matches the filter", () => {
    const rows = [
      row("a", "Winter Tour"),
      row("b", "Charlie Brown Christmas"),
      row("c", "Winter Tour"),
      row("d"),
    ];
    const result = filterByCategory(rows, "Winter Tour");
    expect(result.map((r) => r.venue)).toEqual(["a", "c"]);
  });

  it("excludes rows with no category when a filter is set", () => {
    const rows = [row("a", "Winter Tour"), row("b"), row("c")];
    const result = filterByCategory(rows, "Winter Tour");
    expect(result.map((r) => r.venue)).toEqual(["a"]);
  });

  it("is case-sensitive (no coercion)", () => {
    const rows = [row("a", "Winter Tour"), row("b", "winter tour")];
    const result = filterByCategory(rows, "Winter Tour");
    expect(result.map((r) => r.venue)).toEqual(["a"]);
  });

  it("returns an empty array when no row matches", () => {
    const rows = [row("a", "Winter Tour")];
    expect(filterByCategory(rows, "Summer Tour")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = [row("a", "Winter Tour"), row("b")];
    const snapshot = rows.map((r) => r.venue);
    filterByCategory(rows, "Winter Tour");
    expect(rows.map((r) => r.venue)).toEqual(snapshot);
  });
});
