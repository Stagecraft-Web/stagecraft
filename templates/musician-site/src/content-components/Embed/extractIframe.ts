/**
 * Parse a raw HTML embed snippet (the kind authors copy from a service's
 * "Share / Embed" UI) and produce a sanitized iframe descriptor.
 *
 * Why parse rather than passthrough
 * ---------------------------------
 * Authors paste embed code as-is. Even on a single-artist site (where we
 * trust the author), passing arbitrary HTML straight into the page risks
 * unwanted attributes — `srcdoc`, `name`, inline event handlers, custom
 * data-*, tracking pixels — silently shipping to readers. So we extract
 * the first `<iframe>` element, allowlist its attributes, and rebuild it.
 *
 * Approach
 * --------
 * Embed snippets are tightly shaped: one `<iframe>` with a flat attribute
 * list, optionally wrapped by a `<div>` or surrounded by whitespace. A
 * focused regex on the open-tag substring handles every real-world snippet
 * we've seen (Spotify, Bandcamp, YouTube, Vimeo, SoundCloud, Apple Music)
 * without pulling in a DOM parser. If the input has no iframe at all the
 * parser returns `null` so the renderer can show an inline error.
 *
 * The iframe `title` attribute is preserved verbatim from the snippet but
 * the renderer is expected to override it when the author supplies their
 * own `title` field — providing one is an a11y win.
 */

/**
 * Allowlist of iframe attributes preserved from the source snippet. Any
 * attribute not in this set is dropped. Notably absent:
 *
 *   - `srcdoc`     — would let the snippet inject arbitrary HTML
 *   - `name`       — can be targeted by other windows / scripts
 *   - `sandbox`    — embed providers don't ship it; if they did we'd want
 *                    to apply our own policy rather than trust theirs
 *   - `referrerpolicy` — leak surface; defaults are fine
 *   - inline event handlers (`onload`, `onerror`, ...) — not enumerated
 *     here; the regex only captures known attribute names so unknowns are
 *     dropped by construction
 *   - `class`, `id`, `data-*` — irrelevant in our wrapper context and would
 *     leak provider styling assumptions into our DOM
 */
const ALLOWED_ATTRIBUTES = [
  "src",
  "width",
  "height",
  "title",
  "allow",
  "loading",
  "style",
  "frameborder",
  "allowfullscreen",
] as const;

export type AllowedAttributeName = (typeof ALLOWED_ATTRIBUTES)[number];

/**
 * Parsed, sanitized iframe ready to render. `attributes` contains only
 * keys in `ALLOWED_ATTRIBUTES`. Boolean-style attributes (`allowfullscreen`)
 * are stored as the empty string so callers can render them as bare names.
 */
export interface ParsedIframe {
  attributes: Partial<Record<AllowedAttributeName, string>>;
}

const ALLOWED_SET = new Set<string>(ALLOWED_ATTRIBUTES);

/**
 * Regex matches the opening `<iframe ...>` tag (self-closing or not). We
 * deliberately stop at the first `>` so attribute values containing `>`
 * (rare; only inside quoted strings) are the only edge case — and even
 * those work as long as the attribute value is properly quoted, since we
 * only care about the raw open-tag substring for attribute extraction.
 */
const IFRAME_OPEN_TAG = /<iframe\b([^>]*)>/i;

/**
 * Captures one attribute at a time from the open-tag's attribute list.
 * Three forms supported:
 *
 *   1. name="value"   — double-quoted (most common in embed snippets)
 *   2. name='value'   — single-quoted (Bandcamp uses these)
 *   3. name           — bare boolean attribute (e.g. `allowfullscreen`)
 *
 * Unquoted values (`name=value`) are intentionally not supported: they're
 * invalid HTML5 in any embed snippet I've seen, and rejecting them keeps
 * the parser tighter.
 */
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'))?/g;

/**
 * Extract the first `<iframe>` from the snippet. Returns `null` if none is
 * found — the renderer treats that as a parse failure and shows an inline
 * error block.
 *
 * Pure function; safe to unit-test without a DOM.
 */
export function extractIframe(input: string | null | undefined): ParsedIframe | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const openTagMatch = IFRAME_OPEN_TAG.exec(trimmed);
  if (!openTagMatch) return null;

  const attrSource = openTagMatch[1] ?? "";
  const attributes: Partial<Record<AllowedAttributeName, string>> = {};

  // Reset `lastIndex` defensively — we use `g` flag and reuse the regex.
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_PATTERN.exec(attrSource)) !== null) {
    const rawName = match[1];
    if (!rawName) continue;
    const name = rawName.toLowerCase();
    if (!ALLOWED_SET.has(name)) continue;

    const value =
      match[2] !== undefined
        ? match[2]
        : match[3] !== undefined
          ? match[3]
          : ""; // bare boolean attribute (e.g. `allowfullscreen`)

    attributes[name as AllowedAttributeName] = value;
  }

  // An iframe without a `src` is useless — surface it as a parse failure
  // so the editor knows the snippet is malformed rather than rendering an
  // empty box.
  if (!attributes.src) return null;

  return { attributes };
}

/**
 * Best-effort host extraction from the iframe `src`. Used by the preview
 * and accessibility fallbacks. Returns `null` when the URL is malformed
 * or protocol-relative parsing fails.
 *
 * Implementation note: `URL` is available in Node and modern browsers;
 * Keystatic admin and Astro both meet the bar.
 */
export function extractEmbedHost(src: string | undefined | null): string | null {
  if (typeof src !== "string" || src.length === 0) return null;
  // Protocol-relative (`//foo/bar`) snippets do appear from older share UIs.
  const normalized = src.startsWith("//") ? `https:${src}` : src;
  try {
    return new URL(normalized).host || null;
  } catch {
    return null;
  }
}
