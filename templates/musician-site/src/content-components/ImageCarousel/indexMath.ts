/**
 * Pure slide-index helpers for ImageCarousel. Kept in a standalone module
 * (rather than inline in the React component) so the wrap-around and
 * clamp behavior can be unit-tested without rendering.
 *
 * All functions gracefully handle an empty slide array (length === 0) by
 * returning 0 — the React component uses this to avoid a no-slides crash
 * without having to branch on length at every call site.
 */

/**
 * Next slide index. Wraps from the last slide back to 0.
 *
 * Example: nextIndex(2, 3) === 0  (last → first)
 * Example: nextIndex(0, 3) === 1
 */
export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}

/**
 * Previous slide index. Wraps from 0 back to the last slide.
 *
 * Example: prevIndex(0, 3) === 2  (first → last)
 * Example: prevIndex(2, 3) === 1
 *
 * The `+ length` inside the mod handles JS's modulo behavior for
 * negative numbers (`-1 % 3 === -1`, not 2).
 */
export function prevIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current - 1 + length) % length;
}

/**
 * Clamp an index into the valid range `[0, length - 1]`. Out-of-range or
 * non-finite inputs collapse to 0.
 *
 * Unlike {@link nextIndex} / {@link prevIndex}, this does NOT wrap — it
 * saturates. Used by Home/End key handling (where the user expects to jump
 * to a specific end, not wrap around) and by the dot-button click handler
 * (which should never land off-slide even if the data shape changes at
 * runtime).
 */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return Math.floor(index);
}
