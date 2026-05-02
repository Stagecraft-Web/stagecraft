/**
 * Pagination helper for the progressive-reveal "Show more" pattern used by
 * the TourDatesList block.
 *
 * The renderer emits every `<li>` up-front, marking overflow rows with the
 * `hidden` attribute. A small client-side script un-hides the next batch
 * each time the "Show more" button is clicked. Keeping the splitting logic
 * pure + testable (rather than doing arithmetic inline in the .astro file)
 * means we can assert its edge cases without rendering HTML.
 *
 * `computePageBatches` divides an item list into chunks of `pageSize`:
 *   - The first chunk is the initial page (visible on load).
 *   - Subsequent chunks are the batches revealed by each "Show more" click.
 *
 * Returns `[]` for an empty input; returns `[items]` when everything fits
 * into the first page (caller uses this to decide whether to render the
 * button at all).
 */

/**
 * Split `items` into consecutive batches of up to `pageSize` each.
 *
 * `pageSize` is clamped to `Math.max(1, Math.floor(pageSize))` so invalid
 * values (0, negatives, fractions) never produce a zero-size batch loop.
 */
export function computePageBatches<T>(
  items: readonly T[],
  pageSize: number,
): T[][] {
  if (items.length === 0) {
    return [];
  }
  const size = Math.max(1, Math.floor(pageSize));
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * True when the item list exceeds the first page — i.e. when a "Show more"
 * button needs to render. Mirrors `computePageBatches(items, pageSize).length > 1`
 * but avoids allocating the batches array when the caller only needs the bool.
 */
export function hasOverflow<T>(
  items: readonly T[],
  pageSize: number,
): boolean {
  const size = Math.max(1, Math.floor(pageSize));
  return items.length > size;
}
