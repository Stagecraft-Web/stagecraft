import { describe, expect, it } from "vitest";
import { groupTourDates, type TourDateRow } from "./groupTourDates";

/**
 * Minimal row builder — we only care about `date` + `status` in the bucketing
 * logic, but including `venue` lets us assert identity through the sort order
 * without depending on array indexes.
 */
function row(
  date: string,
  status: "on_sale" | "sold_out" | "canceled",
  venue = `show-${date}-${status}`,
): TourDateRow {
  return { date, status, venue };
}

const TODAY = "2026-04-22";

describe("groupTourDates", () => {
  it("returns empty state when the collection is empty", () => {
    const result = groupTourDates([], TODAY, 3);
    expect(result.primary).toEqual([]);
    expect(result.paddedPast).toEqual([]);
    expect(result.isEmpty).toBe(true);
  });

  it("puts all upcoming in primary when there are 2+, ignores past entirely", () => {
    const dates = [
      row("2026-05-15", "on_sale", "blue-note"),
      row("2026-06-01", "on_sale", "fillmore"),
      row("2026-07-20", "sold_out", "930"),
      row("2025-12-10", "on_sale", "old-show-1"),
      row("2025-11-05", "on_sale", "old-show-2"),
    ];
    const result = groupTourDates(dates, TODAY, 3);
    expect(result.primary.map((d) => d.venue)).toEqual([
      "blue-note",
      "fillmore",
      "930",
    ]);
    expect(result.paddedPast).toEqual([]);
    expect(result.isEmpty).toBe(false);
  });

  it("includes today's date in upcoming (>=, not >)", () => {
    const dates = [
      row(TODAY, "on_sale", "today-show"),
      row("2026-05-01", "on_sale", "later-show"),
    ];
    const result = groupTourDates(dates, TODAY, 3);
    expect(result.primary.map((d) => d.venue)).toEqual([
      "today-show",
      "later-show",
    ]);
  });

  it("renders 1 upcoming + padded past (newest first) when upcoming.length === 1", () => {
    const dates = [
      row("2026-05-15", "on_sale", "next-show"),
      row("2025-12-10", "on_sale", "p1"),
      row("2025-11-05", "on_sale", "p2"),
      row("2025-09-15", "on_sale", "p3"),
      row("2025-06-15", "on_sale", "p4"),
    ];
    const result = groupTourDates(dates, TODAY, 3);
    expect(result.primary.map((d) => d.venue)).toEqual(["next-show"]);
    expect(result.paddedPast.map((d) => d.venue)).toEqual(["p1", "p2", "p3"]);
    expect(result.isEmpty).toBe(false);
  });

  it("renders empty + padded past when upcoming.length === 0", () => {
    const dates = [
      row("2025-12-10", "on_sale", "p1"),
      row("2025-11-05", "sold_out", "p2"),
      row("2025-09-15", "on_sale", "p3"),
      row("2025-06-15", "on_sale", "p4"),
    ];
    const result = groupTourDates(dates, TODAY, 2);
    expect(result.primary).toEqual([]);
    expect(result.paddedPast.map((d) => d.venue)).toEqual(["p1", "p2"]);
    expect(result.isEmpty).toBe(true);
  });

  it("treats canceled shows as past even when their date is in the future", () => {
    const dates = [
      row("2026-05-15", "on_sale", "keep"),
      row("2026-07-20", "canceled", "canceled-future"),
      row("2025-12-10", "on_sale", "old"),
    ];
    const result = groupTourDates(dates, TODAY, 3);
    // Only one upcoming → primary has 1, paddedPast newest-first with
    // canceled-future sorted before old (2026-07-20 > 2025-12-10).
    expect(result.primary.map((d) => d.venue)).toEqual(["keep"]);
    expect(result.paddedPast.map((d) => d.venue)).toEqual([
      "canceled-future",
      "old",
    ]);
  });

  it("sorts upcoming ascending and past descending", () => {
    const dates = [
      row("2026-08-01", "on_sale", "u3"),
      row("2026-05-15", "on_sale", "u1"),
      row("2026-06-01", "on_sale", "u2"),
      row("2025-06-15", "on_sale", "p3"),
      row("2025-12-10", "on_sale", "p1"),
      row("2025-09-15", "on_sale", "p2"),
    ];
    const result = groupTourDates(dates, TODAY, 5);
    expect(result.primary.map((d) => d.venue)).toEqual(["u1", "u2", "u3"]);
    // 2+ upcoming → past omitted.
    expect(result.paddedPast).toEqual([]);
  });

  it("pastPadding of 0 suppresses the padded list entirely", () => {
    const dates = [
      row("2026-05-15", "on_sale", "next"),
      row("2025-12-10", "on_sale", "p1"),
    ];
    const result = groupTourDates(dates, TODAY, 0);
    expect(result.primary.map((d) => d.venue)).toEqual(["next"]);
    expect(result.paddedPast).toEqual([]);
    expect(result.isEmpty).toBe(false);
  });

  it("clamps negative and fractional pastPadding to floor >= 0", () => {
    const dates = [
      row("2026-05-15", "on_sale", "next"),
      row("2025-12-10", "on_sale", "p1"),
      row("2025-11-05", "on_sale", "p2"),
      row("2025-09-15", "on_sale", "p3"),
    ];
    expect(
      groupTourDates(dates, TODAY, -5).paddedPast,
    ).toEqual([]);
    expect(
      groupTourDates(dates, TODAY, 2.9).paddedPast.map((d) => d.venue),
    ).toEqual(["p1", "p2"]);
  });

  it("does not mutate the caller's input array", () => {
    const dates = [
      row("2026-08-01", "on_sale", "u3"),
      row("2026-05-15", "on_sale", "u1"),
      row("2026-06-01", "on_sale", "u2"),
    ];
    const snapshot = dates.map((d) => d.venue);
    groupTourDates(dates, TODAY, 3);
    expect(dates.map((d) => d.venue)).toEqual(snapshot);
  });
});
