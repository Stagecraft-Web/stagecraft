import type { CSSProperties, ReactNode } from "react";
import {
  useBlobObjectUrl,
  type KeystaticImageBlob,
} from "../_shared/keystaticImage";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import type {
  CardMediaAspect,
  CardMediaKind,
  CardOrientation,
  CardSize,
  CardVariant,
} from "../_shared/types";

/**
 * Keystatic admin preview for `{% card %}`. Mirrors the site-side component
 * loosely — enough for authors to recognise what they're editing, not so much
 * that admin CSS drift looks broken. The admin shell doesn't load the site's
 * global.css so we can't reference `--color-*` here (see other previews).
 */

type CardValue = {
  title: string;
  media: KeystaticImageBlob;
  mediaAlt: string;
  file: KeystaticImageBlob;
  sizeLabel: string;
  eyebrow: string;
  meta: string;
  href: string;
  isExternal: boolean;
  variant: CardVariant;
  orientation: CardOrientation;
  size: CardSize;
  hover: boolean;
  mediaKind: CardMediaKind;
  mediaAspect: CardMediaAspect;
};

// Inline hex — previews don't load the site palette.
const KIND_BADGE_BG: Record<CardMediaKind, string> = {
  auto: "#71717a",
  photo: "#0f766e",
  audio: "#4338ca",
  video: "#7c2d12",
  pdf: "#b91c1c",
  icon: "#52525b",
  none: "#a1a1aa",
};

const KIND_BADGE_LABEL: Record<CardMediaKind, string> = {
  auto: "AUTO",
  photo: "PHOTO",
  audio: "AUDIO",
  video: "VIDEO",
  pdf: "PDF",
  icon: "FILE",
  none: "TEXT",
};

// Extension-based guess so the preview badge tracks the file the author
// picked (matches the runtime inferMediaKind policy in Card.astro).
function guessKindFromFilename(filename: string | undefined): CardMediaKind {
  if (!filename) return "none";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "icon";
  if (["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"].includes(ext)) return "photo";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "icon";
}

const frameStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  padding: "0.625rem 0.75rem",
  background: previewBg,
  border: previewBorder,
  borderRadius: previewRadius,
};

export function CardPreview({ value }: { value: CardValue }): ReactNode {
  const {
    title,
    media,
    mediaAlt,
    file,
    sizeLabel,
    eyebrow,
    meta,
    mediaKind,
  } = value;

  const mediaUrl = useBlobObjectUrl(media);
  const fileUrl = useBlobObjectUrl(file);
  const hasAnyMedia = mediaUrl !== null || fileUrl !== null;

  // If the author didn't override, infer from whichever file is set.
  const effectiveKind: CardMediaKind =
    mediaKind && mediaKind !== "auto"
      ? mediaKind
      : guessKindFromFilename(
          (media as KeystaticImageBlob)?.filename ||
            (file as KeystaticImageBlob)?.filename,
        );

  const showImageThumb =
    effectiveKind === "photo" && (mediaUrl || (fileUrl && guessKindFromFilename((file as KeystaticImageBlob)?.filename) === "photo"));
  const thumbUrl = mediaUrl ?? fileUrl;

  return (
    <div style={frameStyle}>
      <MediaSlot
        kind={effectiveKind}
        thumbUrl={showImageThumb ? thumbUrl : null}
        alt={mediaAlt || title}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: previewTextMuted,
              marginBottom: "0.125rem",
            }}
          >
            {eyebrow}
          </div>
        )}
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
          {title || "(no title)"}
        </div>
        {meta && (
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
            {meta}
          </div>
        )}
        {(sizeLabel || hasAnyMedia) && (
          <div
            style={{
              fontSize: "0.6875rem",
              color: previewTextMuted,
              marginTop: "0.25rem",
            }}
          >
            {sizeLabel ||
              (fileUrl ? "Downloadable" : "")}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaSlot({
  kind,
  thumbUrl,
  alt,
}: {
  kind: CardMediaKind;
  thumbUrl: string | null;
  alt: string;
}): ReactNode {
  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt={alt || "Card preview"}
        style={{
          width: "3rem",
          height: "3rem",
          objectFit: "cover",
          borderRadius: previewRadius,
          flexShrink: 0,
        }}
      />
    );
  }
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
        background: KIND_BADGE_BG[kind],
        borderRadius: previewRadius,
        flexShrink: 0,
      }}
    >
      {KIND_BADGE_LABEL[kind]}
    </span>
  );
}
