import type { CSSProperties, ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
  labelStyle,
} from "../_shared/previewTokens";
import type { MediaEmbedService } from "./toEmbedUrl";

type MediaEmbedValue = {
  service: MediaEmbedService;
  id: string;
  title: string;
};

// Service-specific accent colors keep the previews visually distinct so
// editors can tell at a glance which service is wired up. Inline hex per
// the documented preview-token convention (Keystatic admin doesn't load the
// site CSS).
const SERVICE_THEMES: Record<
  MediaEmbedService,
  { label: string; accent: string; bg: string }
> = {
  "spotify-album": { label: "Spotify Album", accent: "#1db954", bg: "#0a3a1f" },
  "bandcamp-album": { label: "Bandcamp Album", accent: "#629aa9", bg: "#1c3a44" },
  "youtube-video": { label: "YouTube Video", accent: "#ff0000", bg: "#2a0a0a" },
  "vimeo-video": { label: "Vimeo Video", accent: "#1ab7ea", bg: "#0a2a3a" },
};

export function MediaEmbedPreview({
  value,
}: {
  value: MediaEmbedValue;
}): ReactNode {
  const { service, id, title } = value;
  const theme = SERVICE_THEMES[service] ?? SERVICE_THEMES["spotify-album"];
  const isVideo = service === "youtube-video" || service === "vimeo-video";

  const playerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: isVideo ? "16 / 9" : "5 / 2",
    background: `linear-gradient(135deg, ${theme.bg} 0%, #000000 100%)`,
    borderRadius: previewRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          ...labelStyle,
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: theme.accent,
          }}
        />
        {theme.label}
      </div>

      <div style={playerStyle}>
        <PlayBadge accent={theme.accent} />
      </div>

      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.8125rem",
          color: previewText,
          fontWeight: 500,
        }}
      >
        {title || `${theme.label} embed`}
      </div>
      {id && (
        <div
          style={{
            marginTop: "0.125rem",
            fontSize: "0.6875rem",
            color: previewTextMuted,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            wordBreak: "break-all",
          }}
        >
          {id}
        </div>
      )}
    </div>
  );
}

function PlayBadge({ accent }: { accent: string }): ReactNode {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.55)" />
      <circle cx="12" cy="12" r="11" fill="none" stroke={accent} strokeWidth="1" />
      <polygon points="10 8 16 12 10 16 10 8" fill="#ffffff" />
    </svg>
  );
}
