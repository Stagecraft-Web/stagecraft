/**
 * Category-filter helper for the TourDatesList block.
 *
 * Lives next to `groupTourDates` so the renderer can call them in order:
 *
 *   const filtered = filterByCategory(allDates, categoryFilter);
 *   const grouped = groupTourDates(filtered, today, pastPadding);
 *
 * Kept as a separate single-purpose helper so `groupTourDates` stays a
 * pure bucketing function (no filter concerns) and each piece is testable
 * in isolation.
 *
 * A blank / undefined `categoryFilter` is the "no filter" case and the
 * input is returned unchanged. Matching is a case-sensitive string
 * equality check; if authors need fuzzier behaviour they can normalise
 * their category values upstream.
 */

export interface CategorizedTourDateRow {
  category?: string;
  // Extra fields allowed — callers pass the full `TourDate` objects through.
  [key: string]: unknown;
}

/**
 * Return only rows whose `category` matches `categoryFilter`.
 *
 * - If `categoryFilter` is undefined, empty, or all-whitespace, returns
 *   the input unchanged (filter disabled).
 * - Otherwise, rows are kept iff their `category` field equals the filter
 *   string exactly. Rows with no `category` are excluded in that case.
 */
export function filterByCategory<T extends CategorizedTourDateRow>(
  rows: readonly T[],
  categoryFilter: string | undefined,
): T[] {
  if (!categoryFilter || categoryFilter.trim() === "") {
    return rows.slice();
  }
  return rows.filter((r) => r.category === categoryFilter);
}
