import type { CardMediaKind } from "../_shared/types";

// File-extension → media kind. Kept here (not in _shared/types) because this
// is the kind-inference POLICY for Card specifically; types.ts is just the
// enum. If another component needs extension-based dispatch in the future we
// can lift this out, but today only Card uses it.

const PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const PDF_EXTS = new Set(["pdf"]);

/**
 * Infer a Card's media kind from a file path or URL.
 *
 * Used when the author didn't set `mediaKind` (or set it to `"auto"`):
 * extension drives the preview dispatch so `{% card file="./foo.mp3" /%}`
 * renders an inline audio player without the author spelling that out.
 *
 * Unknown extensions → `"icon"` (generic file icon) rather than throwing:
 * a .zip or .stem should still render as a downloadable tile.
 *
 * Paths with query strings or fragments (e.g. CDN URLs) are tolerated —
 * we split off `?` and `#` before looking at the extension.
 */
export function inferMediaKind(path: string | undefined): CardMediaKind {
  if (!path || typeof path !== "string") return "none";

  // Strip query + fragment so "https://cdn.example.com/x.jpg?v=3#hash" still
  // reads as a photo.
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  const ext = clean.split(".").pop()?.toLowerCase();
  if (!ext) return "icon";

  if (PHOTO_EXTS.has(ext)) return "photo";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (PDF_EXTS.has(ext)) return "pdf";
  return "icon";
}

/**
 * Default media aspect for a given kind. Used when the author didn't set
 * `mediaAspect` explicitly.
 *
 * - `photo` / `video` / `audio` / `pdf` / `icon` → 4:3 keeps every item in a
 *   mixed list the same height so titles align.
 * - `none` → `auto` (no media area).
 *
 * Callers that want a different ratio (e.g. release covers at 1:1, post
 * thumbnails at 16:9) should pass `mediaAspect` explicitly.
 */
export function defaultAspectForKind(kind: CardMediaKind): "4:3" | "auto" {
  return kind === "none" ? "auto" : "4:3";
}
