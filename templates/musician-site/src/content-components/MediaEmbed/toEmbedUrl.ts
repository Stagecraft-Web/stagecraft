/**
 * Pure helpers for turning a `media-embed` block's `service` + `id` (which
 * may be a raw service ID or a full URL) into an iframe-ready embed URL.
 *
 * Kept in its own file so the URL/ID parsing can be unit-tested without the
 * Astro renderer. The YouTube/Vimeo extractors mirror the equivalents in
 * `VideoGallery/toEmbeddable.ts` (PR #28); a follow-up can dedupe once both
 * land.
 */

export type MediaEmbedService =
  | "spotify-album"
  | "bandcamp-album"
  | "youtube-video"
  | "vimeo-video";

export const MEDIA_EMBED_SERVICES: readonly MediaEmbedService[] = [
  "spotify-album",
  "bandcamp-album",
  "youtube-video",
  "vimeo-video",
];

export interface MediaEmbedResolved {
  /** The iframe `src`. Null when the input couldn't be parsed. */
  embedUrl: string | null;
  /** Suggested aspect ratio (CSS `aspect-ratio` value) for the container. */
  aspectRatio: string;
  /** Human-readable service label (e.g. "Spotify"), used for fallback titles. */
  serviceLabel: string;
}

const SERVICE_LABELS: Record<MediaEmbedService, string> = {
  "spotify-album": "Spotify",
  "bandcamp-album": "Bandcamp",
  "youtube-video": "YouTube",
  "vimeo-video": "Vimeo",
};

// ---------------------------------------------------------------------------
// Per-service ID extractors. Each accepts either a raw service ID or a full
// URL and returns the canonical ID the embed URL needs (or null on failure).
// ---------------------------------------------------------------------------

/** Spotify album IDs are 22-character base62 strings. */
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export function extractSpotifyAlbumId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (SPOTIFY_ID_PATTERN.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "open.spotify.com" && host !== "spotify.com") return null;
    // Paths look like /album/<id> or /embed/album/<id>, optionally with a
    // locale segment like /intl-en/album/<id>.
    const parts = u.pathname.split("/").filter(Boolean);
    const albumIdx = parts.indexOf("album");
    if (albumIdx === -1) return null;
    const candidate = parts[albumIdx + 1];
    if (candidate && SPOTIFY_ID_PATTERN.test(candidate)) return candidate;
    return null;
  } catch {
    return null;
  }
}

/**
 * Bandcamp's embed only needs a numeric album ID (e.g. `2089841200`). Their
 * public album URLs (`https://artist.bandcamp.com/album/<slug>`) do NOT
 * expose this number — editors find it in the "Share / Embed this album"
 * dialog. So we only accept a bare digit string here, with a generous parse
 * for users who paste an `album=<id>` query param.
 */
const BANDCAMP_ID_PATTERN = /^\d+$/;

export function extractBandcampAlbumId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (BANDCAMP_ID_PATTERN.test(trimmed)) return trimmed;
  // Tolerate pasting the full embed `src` like
  // `https://bandcamp.com/EmbeddedPlayer/album=123/...` — pull the digits
  // after `album=`.
  const match = trimmed.match(/album=(\d+)/);
  if (match) return match[1] ?? null;
  return null;
}

/** YouTube video IDs are 11-char base64url strings. Mirrors VideoGallery's helper. */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare ID: 11 chars of [A-Za-z0-9_-].
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && ["embed", "shorts", "v"].includes(parts[0]!)) {
        return parts[1] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Vimeo video IDs are numeric. Mirrors VideoGallery's helper. */
export function extractVimeoVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const candidate = parts[0] === "video" ? parts[1] : parts[0];
    if (candidate && /^\d+$/.test(candidate)) return candidate;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public resolver
// ---------------------------------------------------------------------------

/**
 * Build an iframe-ready embed URL for a given service + ID/URL input.
 * The aspect ratio is service-shaped: Spotify/Bandcamp players are squat
 * "card" players, YouTube/Vimeo are 16:9 video players.
 */
export function resolveMediaEmbed(
  service: MediaEmbedService,
  input: string,
): MediaEmbedResolved {
  const serviceLabel = SERVICE_LABELS[service];

  switch (service) {
    case "spotify-album": {
      const id = extractSpotifyAlbumId(input);
      return {
        embedUrl: id ? `https://open.spotify.com/embed/album/${id}` : null,
        // Spotify's compact-card embed is ~152px tall; the standard album
        // player is 380px. We want the standard one — it shows the tracklist.
        // Render at a fixed 380px via the iframe height attribute and let the
        // container span 100% width; aspect-ratio is a no-op when height is
        // explicit, so we leave it as `auto` to mean "don't constrain".
        aspectRatio: "auto",
        serviceLabel,
      };
    }
    case "bandcamp-album": {
      const id = extractBandcampAlbumId(input);
      // Bandcamp's recommended embed: artwork+tracklist, 350x470 by default,
      // or a wider 400px+ "big artwork" variant. We use the artwork-on-side
      // layout (size=large) which scales nicely to container width.
      return {
        embedUrl: id
          ? `https://bandcamp.com/EmbeddedPlayer/album=${id}/size=large/bgcol=ffffff/linkcol=0687f5/artwork=small/transparent=true/`
          : null,
        // Bandcamp's "size=large + artwork=small" is ~120px tall; we'll fix
        // the iframe height in the renderer rather than via aspect-ratio.
        aspectRatio: "auto",
        serviceLabel,
      };
    }
    case "youtube-video": {
      const id = extractYouTubeVideoId(input);
      return {
        embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}` : null,
        aspectRatio: "16 / 9",
        serviceLabel,
      };
    }
    case "vimeo-video": {
      const id = extractVimeoVideoId(input);
      return {
        embedUrl: id ? `https://player.vimeo.com/video/${id}` : null,
        aspectRatio: "16 / 9",
        serviceLabel,
      };
    }
  }
}
