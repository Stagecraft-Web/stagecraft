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
 *
 * Intrinsic dimensions
 * --------------------
 * Beyond the raw attribute bag, the parser also surfaces the iframe's
 * intrinsic width/height (in pixels) and the host of its `src`. Dimensions
 * are pulled from the `width`/`height` attributes if they are pixel values,
 * otherwise from inline `style="width: Xpx; height: Ypx"` rules. Percent
 * values (`width="100%"`) don't count — they describe the iframe's
 * rendered width, not its natural dimensions. ResponsiveEmbed uses these
 * to auto-derive an aspect ratio for fixed-size embeds (Bandcamp 350×470).
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
 *
 * `intrinsicWidth` / `intrinsicHeight` are the pixel dimensions derived
 * from either the `width`/`height` attributes or the inline style — `null`
 * when the source snippet doesn't express a pixel value (e.g. Spotify's
 * `width="100%"`). `host` is the host of `attributes.src`, extracted via
 * `extractEmbedHost`.
 */
export interface ParsedIframe {
  attributes: Partial<Record<AllowedAttributeName, string>>;
  intrinsicWidth: number | null;
  intrinsicHeight: number | null;
  host: string | null;
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
 * Matches a pixel-valued dimension inside the `width` / `height` attribute.
 * Accepts a bare integer (`350`) or an integer with `px` suffix (`350px`),
 * rejecting percent (`100%`) and other unit values so the caller only gets
 * true pixel dimensions.
 */
const PIXEL_ATTR_VALUE = /^\s*(\d+)(?:px)?\s*$/i;

/**
 * Matches `width:` / `height:` declarations in an inline style string and
 * pulls out the pixel value. Declarations are separated by `;` and we only
 * keep ones whose value ends in `px` (so `width: 100%` is ignored).
 */
function parsePixelFromStyle(style: string, property: "width" | "height"): number | null {
  // Anchored to the property name, allowing optional whitespace, matching
  // values ending in `px`. Non-greedy on the number to be forgiving of
  // decimals (e.g. `350.5px`) by truncating to the integer part.
  const pattern = new RegExp(
    `(?:^|;)\\s*${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px\\s*(?:;|$)`,
    "i",
  );
  const match = pattern.exec(style);
  if (!match || !match[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Pull a pixel dimension out of a raw attribute value (`width="350"` or
 * `height="470px"`), returning `null` for percent or other non-pixel
 * values.
 */
function parsePixelFromAttribute(raw: string | undefined): number | null {
  if (typeof raw !== "string") return null;
  const match = PIXEL_ATTR_VALUE.exec(raw);
  if (!match || !match[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolve the intrinsic pixel dimension from either the attribute or the
 * inline style, preferring the attribute when both are present and valid.
 */
function resolveIntrinsicDimension(
  attrValue: string | undefined,
  style: string | undefined,
  property: "width" | "height",
): number | null {
  const fromAttr = parsePixelFromAttribute(attrValue);
  if (fromAttr !== null) return fromAttr;
  if (typeof style !== "string" || style.length === 0) return null;
  return parsePixelFromStyle(style, property);
}

/**
 * Remove `width:` and `height:` declarations from an inline style string,
 * preserving all other rules. Used by the renderer when a wrapper takes
 * over sizing — keeping the raw `style="border:0; width:350px"` on the
 * iframe would fight the wrapper's absolute-positioning rules.
 *
 * Returns the cleaned string. An empty string means every remaining rule
 * was dimensional; callers typically treat that as "drop the style
 * attribute entirely".
 */
export function stripDimensionsFromStyle(style: string | undefined | null): string {
  if (typeof style !== "string" || style.length === 0) return "";
  return style
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => {
      if (decl.length === 0) return false;
      const colonIdx = decl.indexOf(":");
      if (colonIdx === -1) return true;
      const property = decl.slice(0, colonIdx).trim().toLowerCase();
      return property !== "width" && property !== "height";
    })
    .join("; ");
}

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

  const intrinsicWidth = resolveIntrinsicDimension(attributes.width, attributes.style, "width");
  const intrinsicHeight = resolveIntrinsicDimension(attributes.height, attributes.style, "height");
  const host = extractEmbedHost(attributes.src);

  return { attributes, intrinsicWidth, intrinsicHeight, host };
}

/**
 * Astro's IframeHTMLAttributes types each attribute narrowly:
 *
 *   - `loading`: `"lazy" | "eager" | null | undefined`
 *   - `allowfullscreen`: `boolean | string`
 *   - `frameborder`: `string`
 *   - everything else on our allowlist: `string`
 *
 * The parser hands us `string` values across the board, so this type narrows
 * `loading` to its accepted union and converts the bare-boolean
 * `allowfullscreen=""` to `true` (Astro drops empty-string attributes during
 * spread, which would otherwise lose the attribute entirely).
 */
export type IframeAttrs = {
  src?: string;
  width?: string;
  height?: string;
  title?: string;
  allow?: string;
  loading?: "lazy" | "eager";
  style?: string;
  frameborder?: string;
  allowfullscreen?: boolean;
};

/**
 * Build the spreadable attribute set Astro needs to render `<iframe {...attrs} />`.
 *
 * Shared between Embed (plain) and ResponsiveEmbed (aspect-ratio wrapped) so
 * the title fallback chain, attribute narrowing, and lazy-loading default
 * stay in one place. ResponsiveEmbed passes `stripDimensions: true` so the
 * iframe's hardcoded width/height (attribute and inline style) don't fight
 * the wrapper's `position: absolute; inset: 0` sizing.
 */
export function buildIframeAttrs(
  parsed: ParsedIframe,
  options: { title?: string; stripDimensions?: boolean } = {},
): IframeAttrs {
  const source = parsed.attributes;
  const resolvedTitle =
    options.title?.trim() ||
    source.title?.trim() ||
    (parsed.host ? `Embedded content from ${parsed.host}` : "Embedded content");

  const attrs: IframeAttrs = {
    src: source.src,
    width: source.width,
    height: source.height,
    allow: source.allow,
    style: source.style,
    frameborder: source.frameborder,
    title: resolvedTitle,
    // Lazy-load by default — embed iframes are network-heavy and rarely
    // above the fold. Authors who want eager loading can edit the snippet.
    loading: source.loading === "eager" ? "eager" : "lazy",
    // Bare boolean attribute (`<iframe allowfullscreen>`). Storing `true`
    // tells Astro to render it without a value.
    allowfullscreen: source.allowfullscreen !== undefined ? true : undefined,
  };

  if (options.stripDimensions) {
    delete attrs.width;
    delete attrs.height;
    const cleanedStyle = stripDimensionsFromStyle(source.style);
    if (cleanedStyle.length > 0) {
      attrs.style = cleanedStyle;
    } else {
      delete attrs.style;
    }
  }

  return attrs;
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
