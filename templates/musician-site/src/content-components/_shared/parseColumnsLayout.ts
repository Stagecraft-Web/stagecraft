/**
 * Convert a dash-separated layout string (e.g. "1-2") into a valid
 * CSS `grid-template-columns` value (e.g. "1fr 2fr").
 *
 * - Blank / missing input falls back to "1fr 1fr".
 * - Non-numeric or non-positive tracks are dropped; if nothing valid
 *   remains the fallback is used.
 */
export function parseColumnsLayout(raw: string | null | undefined): string {
  const layout = (raw ?? "").trim() || "1-1";
  const tracks = layout
    .split("-")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return tracks.length > 0 ? tracks.map((n) => `${n}fr`).join(" ") : "1fr 1fr";
}
