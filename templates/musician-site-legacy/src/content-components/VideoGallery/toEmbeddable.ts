/**
 * Pure helpers for turning a `Video` content entry into the data the
 * VideoGallery renderer needs: an iframe `embedUrl`, a thumbnail URL, and
 * an `isEmbeddable` flag.
 *
 * Kept separate from VideoGallery.astro so it can be unit-tested without
 * bringing the Astro runtime along.
 */
import type { Video } from "../../lib/schemas";

export interface EmbeddableVideo {
  title: string;
  description?: string;
  /** The original URL the author entered (used as the link-out fallback). */
  url: string;
  /** YouTube/Vimeo iframe-safe URL, when we can derive one. */
  embedUrl: string | null;
  /** Best-effort thumbnail URL. Null when we can't derive one cheaply. */
  thumbnailUrl: string | null;
  /** True when we have an embedUrl — the lightbox uses this to decide. */
  isEmbeddable: boolean;
  type: Video["type"];
}

/**
 * Extract a YouTube video ID from any of the common URL shapes:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /v/ID
      if (parts.length >= 2 && ["embed", "shorts", "v"].includes(parts[0]!)) {
        return parts[1] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract a Vimeo numeric video ID from common URL shapes:
 *   https://vimeo.com/12345678
 *   https://player.vimeo.com/video/12345678
 */
export function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // /video/ID for player.vimeo.com, /ID for vimeo.com
    const candidate = parts[0] === "video" ? parts[1] : parts[0];
    if (candidate && /^\d+$/.test(candidate)) return candidate;
    return null;
  } catch {
    return null;
  }
}

export function toEmbeddable(video: Video): EmbeddableVideo {
  if (video.type === "youtube") {
    const id = extractYouTubeId(video.url);
    if (id) {
      return {
        title: video.title,
        description: video.description,
        url: video.url,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        isEmbeddable: true,
        type: video.type,
      };
    }
  } else if (video.type === "vimeo") {
    const id = extractVimeoId(video.url);
    if (id) {
      return {
        title: video.title,
        description: video.description,
        url: video.url,
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
        // Vimeo thumbnails require an oEmbed roundtrip. Skipping for now —
        // the placeholder icon renders in its place.
        thumbnailUrl: null,
        isEmbeddable: true,
        type: video.type,
      };
    }
  }
  // "other" or unparsable URL: link out instead of embedding.
  return {
    title: video.title,
    description: video.description,
    url: video.url,
    embedUrl: null,
    thumbnailUrl: null,
    isEmbeddable: false,
    type: video.type,
  };
}
