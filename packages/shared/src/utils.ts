/** Shared utility functions used across apps and packages. */

/** Capitalise the first letter of a string. */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Return true if `raw` is a valid http or https URL. */
export function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Strip all HTML tags and decode common HTML entities.
 * Returns plain text suitable for use in content files or comparisons.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infer an artist/brand name from a site title string.
 * Strips common suffixes like "— Official Site", "| Music", " - Home".
 */
export function inferArtistName(title: string): string {
  return title
    .replace(/[-–—|].*$/, "")
    .replace(
      /\s+(official|music|home|website|band|artist|musician|composer|singer|guitar|piano|drums)\s*$/i,
      ""
    )
    .trim();
}
