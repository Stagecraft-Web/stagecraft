/**
 * Bucket + sort tour dates around a "today" cutoff and decide which rows
 * render in the primary list vs. the "Recent shows" padding slot.
 *
 * The cutoff is a plain ISO "YYYY-MM-DD" string — date fields on tour-date
 * entries are also ISO, and ISO date strings sort lexicographically the
 * same way they sort chronologically, so no Date parsing is required.
 *
 * Rules (spec §3.2):
 *   - Upcoming = `date >= today AND status !== "canceled"`, sorted ascending.
 *   - Past     = `date <  today OR  status === "canceled"`, sorted descending.
 *   - upcoming.length >= 2 → render upcoming-only; padded past slot is empty.
 *   - upcoming.length === 1 → render that 1 show + up to `pastPadding` most-
 *     recent past shows under a "Recent shows" heading.
 *   - upcoming.length === 0 → render empty-state + same padded past list.
 *
 * The function is pure and takes a minimal row shape so it can be tested
 * without the full `TourDate` zod type.
 */

export interface TourDateRow {
  date: string;
  status: string;
  // Extra fields allowed — callers pass the full `TourDate` objects through.
  [key: string]: unknown;
}

export interface GroupedTourDates<T extends TourDateRow> {
  /** The main list rendered above any "Recent shows" heading. */
  primary: T[];
  /** The recent-past padding list (newest first). Empty when not applicable. */
  paddedPast: T[];
  /** True when the caller should show the `emptyMessage` copy. */
  isEmpty: boolean;
}

export function groupTourDates<T extends TourDateRow>(
  allDates: readonly T[],
  today: string,
  pastPadding: number,
): GroupedTourDates<T> {
  const upcoming = allDates
    .filter((d) => d.date >= today && d.status !== "canceled")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const past = allDates
    .filter((d) => d.date < today || d.status === "canceled")
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  if (upcoming.length >= 2) {
    return { primary: upcoming, paddedPast: [], isEmpty: false };
  }

  const padLength = Math.max(0, Math.floor(pastPadding));
  const paddedPast = past.slice(0, padLength);

  if (upcoming.length === 1) {
    return { primary: [upcoming[0]!], paddedPast, isEmpty: false };
  }

  return { primary: [], paddedPast, isEmpty: true };
}
