import type { ReactNode } from "react";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

/**
 * Keystatic admin preview for the {% video %} block.
 *
 * Mirrors the schema's flat shape: `slug` for collection mode or `url`/`type`
 * for direct-URL mode. The preview shows a labeled play-button placeholder so
 * the author knows which mode they've picked without rendering an actual
 * iframe (Keystatic admin doesn't load the site CSS — see
 * _shared/previewTokens.ts).
 */

// Keystatic threads its inferred runtime types (with `string | null`,
// readonly markers, etc.) through ContentView. Mirror those exact
// nullability shapes so the inferred prop type matches without a cast.
interface VideoValue {
  slug: string | null;
  url: string | null;
  type: string | null;
  title: string | null;
  caption: string | null;
}

export function VideoPreview({ value }: { value: VideoValue }): ReactNode {
  const { slug, url, caption } = value;
  const subtitle = describeSource(slug, url);

  return (
    <StockPreviewFrame label="Video">
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          background: previewBgMuted,
          border: previewBorder,
          borderRadius: previewRadius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: previewTextMuted,
        }}
      >
        <PlayIcon />
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.75rem",
          color: previewTextMuted,
          textAlign: "center",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subtitle}
      </div>
      {caption && <CaptionNote>{caption}</CaptionNote>}
    </StockPreviewFrame>
  );
}

function describeSource(slug: string | null, url: string | null): string {
  const trimmedSlug = slug?.trim() ?? "";
  if (trimmedSlug.length > 0) return `videos/${trimmedSlug}`;
  const trimmedUrl = url?.trim() ?? "";
  if (trimmedUrl.length === 0) return "(pick a slug or paste a URL)";
  try {
    return new URL(trimmedUrl).host;
  } catch {
    return trimmedUrl;
  }
}

function PlayIcon(): ReactNode {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
      <polygon points="10 8 16 12 10 16 10 8" fill="white" />
    </svg>
  );
}
