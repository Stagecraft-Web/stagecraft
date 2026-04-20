import type { CSSProperties, ReactNode } from "react";
import {
  useBlobObjectUrl,
  type KeystaticImageBlob,
} from "../_shared/keystaticImage";
import {
  previewBorder,
  previewBg,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import type { DownloadKind } from "../_shared/types";

/**
 * In the admin, `fields.file` surfaces its value the same way `fields.image`
 * does — as `null` or a blob-shaped object — when the user is uploading or
 * after Keystatic has read the persisted file back from disk. We reuse the
 * existing `useBlobObjectUrl` hook (originally written for Image previews)
 * since the runtime shape is identical.
 */
type DownloadValue = {
  label: string;
  file: KeystaticImageBlob;
  kind: DownloadKind;
  description: string;
  credit: string;
  sizeLabel: string;
};

// Inline hex per the documented preview pattern (admin shell doesn't load the
// site's global.css, so site --color-* CSS variables don't resolve here).
const PDF_BADGE_BG = "#b91c1c";
const OTHER_BADGE_BG = "#52525b";
const PHOTO_BADGE_BG = "#0f766e";
const AUDIO_BADGE_BG = "#4338ca";
const VIDEO_BADGE_BG = "#7c2d12";

const KIND_LABEL: Record<DownloadKind, string> = {
  photo: "PHOTO",
  audio: "AUDIO",
  video: "VIDEO",
  pdf: "PDF",
  other: "FILE",
};

const KIND_BG: Record<DownloadKind, string> = {
  photo: PHOTO_BADGE_BG,
  audio: AUDIO_BADGE_BG,
  video: VIDEO_BADGE_BG,
  pdf: PDF_BADGE_BG,
  other: OTHER_BADGE_BG,
};

const previewFrameStyle: CSSProperties = {
  display: "flex",
  gap: "0.625rem",
  alignItems: "center",
  padding: "0.5rem 0.625rem",
  background: previewBg,
  border: previewBorder,
  borderRadius: previewRadius,
};

export function DownloadPreview({ value }: { value: DownloadValue }): ReactNode {
  const { label, file, kind, description, sizeLabel } = value;
  const url = useBlobObjectUrl(file);
  const hasFile = url !== null;

  return (
    <div style={previewFrameStyle}>
      <KindPreview kind={kind} url={url} hasFile={hasFile} label={label} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: previewText,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label || "(no label)"}
        </div>
        {description && (
          <div
            style={{
              fontSize: "0.75rem",
              color: previewTextMuted,
              marginTop: "0.125rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {description}
          </div>
        )}
        {sizeLabel && (
          <div
            style={{
              fontSize: "0.6875rem",
              color: previewTextMuted,
              marginTop: "0.125rem",
            }}
          >
            {sizeLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function KindPreview({
  kind,
  url,
  hasFile,
  label,
}: {
  kind: DownloadKind;
  url: string | null;
  hasFile: boolean;
  label: string;
}): ReactNode {
  // Photo: show actual thumbnail when uploaded; otherwise a badge placeholder.
  if (kind === "photo" && hasFile && url) {
    return (
      <img
        src={url}
        alt={label || "Uploaded photo"}
        style={{
          width: "3rem",
          height: "3rem",
          objectFit: "cover",
          borderRadius: previewRadius,
          background: previewBgMuted,
        }}
      />
    );
  }

  if (kind === "audio") {
    return <AudioBarsBadge />;
  }

  if (kind === "video") {
    return <PlayTileBadge />;
  }

  // pdf / other / unset photo → styled type badge
  return <TypeBadge label={KIND_LABEL[kind]} bg={KIND_BG[kind]} />;
}

function TypeBadge({ label, bg }: { label: string; bg: string }): ReactNode {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "3rem",
        height: "3rem",
        padding: "0.25rem 0.5rem",
        fontSize: "0.6875rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "#ffffff",
        background: bg,
        borderRadius: previewRadius,
      }}
    >
      {label}
    </span>
  );
}

function AudioBarsBadge(): ReactNode {
  return (
    <div
      style={{
        width: "3rem",
        height: "3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        background: AUDIO_BADGE_BG,
        borderRadius: previewRadius,
      }}
      aria-hidden
    >
      {[0.6, 0.9, 0.45, 0.75, 0.5].map((h, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: "3px",
            height: `${h * 100}%`,
            background: "#ffffff",
            borderRadius: "1px",
          }}
        />
      ))}
    </div>
  );
}

function PlayTileBadge(): ReactNode {
  return (
    <div
      style={{
        width: "3rem",
        height: "3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: VIDEO_BADGE_BG,
        borderRadius: previewRadius,
        color: "#ffffff",
      }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6,4 20,12 6,20" />
      </svg>
    </div>
  );
}
