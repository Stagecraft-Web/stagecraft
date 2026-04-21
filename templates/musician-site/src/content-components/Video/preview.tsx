import type { ReactNode } from "react";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";
import type { VideoUrlType } from "../_shared/types";

/**
 * Keystatic admin preview for the {% video %} block.
 *
 * Mirrors the schema's `fields.conditional` shape: `source` is the
 * discriminant ("collection" | "url"), `value` is the matching object.
 * Caption sits alongside the conditional at the top level. The preview
 * shows a labeled play-button placeholder so the author knows which mode
 * they've picked without rendering an actual iframe (Keystatic admin
 * doesn't load the site CSS — see _shared/previewTokens.ts).
 */

// Keystatic threads its inferred runtime types (with `string | null` for the
// url field, readonly markers, etc.) through ContentView. Mirror those exact
// nullability shapes so the inferred prop type matches without a cast.
type VideoSourceValue =
  | { discriminant: "collection"; value: { slug: string | null } }
  | {
      discriminant: "url";
      value: {
        url: string | null;
        type: VideoUrlType;
        title: string | null;
      };
    };

interface VideoValue {
  source: VideoSourceValue;
  caption: string | null;
}

export function VideoPreview({ value }: { value: VideoValue }): ReactNode {
  const { source, caption } = value;
  const subtitle = describeSource(source);

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

function describeSource(source: VideoSourceValue): string {
  if (source.discriminant === "collection") {
    const slug = source.value.slug?.trim() ?? "";
    return slug.length > 0 ? `videos/${slug}` : "videos/(pick a slug)";
  }
  const url = source.value.url?.trim() ?? "";
  if (url.length === 0) return "(paste a URL)";
  try {
    return new URL(url).host;
  } catch {
    return url;
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
