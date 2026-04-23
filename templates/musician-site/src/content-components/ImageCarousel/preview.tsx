import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
  previewAccent,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote, ImageIcon } from "../_shared/previewChrome";
import type { CarouselAspectRatio } from "./schema";

type ImageCarouselValue = {
  photosCollection: string;
  aspectRatio: CarouselAspectRatio;
  areArrowsHidden: boolean;
  areDotsHidden: boolean;
};

/**
 * Keystatic admin preview for `image-carousel`. The admin shell doesn't
 * load site CSS, so we render stock slide chrome inline (matching the
 * style used by other previews in this template).
 *
 * When both `areArrowsHidden` and `areDotsHidden` are true we show an
 * inline validation warning — matches the runtime check in the astro
 * renderer so editors see the same feedback whether they're in the admin
 * UI or the dev-server preview.
 */
export function ImageCarouselPreview({
  value,
}: {
  value: ImageCarouselValue;
}): ReactNode {
  const { photosCollection, aspectRatio, areArrowsHidden, areDotsHidden } = value;
  const hasNavError = areArrowsHidden && areDotsHidden;

  const aspectPadding = aspectRatioToPadding(aspectRatio);
  const filterLabel = photosCollection
    ? `Filtered: ${photosCollection}`
    : "All photos";

  return (
    <StockPreviewFrame label="Image Carousel">
      {hasNavError ? (
        <div
          style={{
            padding: "0.75rem 0.875rem",
            border: previewBorder,
            borderLeft: `4px solid ${previewAccent}`,
            borderRadius: previewRadius,
            background: previewBg,
            fontSize: "0.75rem",
            color: previewText,
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <strong>Carousel is missing navigation controls.</strong>
          <span style={{ color: previewTextMuted }}>
            Leave at least one of arrows or dots visible.
          </span>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: aspectPadding,
            background: `linear-gradient(135deg, hsl(220 30% 85%) 0%, hsl(260 30% 75%) 100%)`,
            borderRadius: previewRadius,
            overflow: "hidden",
          }}
        >
          {/* Stock image placeholder with the generic photo icon. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <ImageIcon />
          </div>

          {/* Top-right filter badge so editors can see at a glance whether
              the carousel is filtered to a specific usage slot. */}
          <span
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              display: "inline-flex",
              alignItems: "center",
              padding: "0.125rem 0.5rem",
              background: "#ffffff",
              border: previewBorder,
              borderRadius: "999px",
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: previewText,
            }}
          >
            {filterLabel}
          </span>

          {/* Stock arrow affordances — matches the live component. */}
          {!areArrowsHidden && (
            <>
              <PreviewArrow side="left" />
              <PreviewArrow side="right" />
            </>
          )}
        </div>
      )}

      {!hasNavError && !areDotsHidden && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "0.625rem",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: "0.625rem",
                height: "0.625rem",
                borderRadius: "9999px",
                border: `2px solid ${previewTextMuted}`,
                background: i === 0 ? previewText : "transparent",
                borderColor: i === 0 ? previewText : previewTextMuted,
              }}
            />
          ))}
        </div>
      )}

      <CaptionNote>
        Populated from your Photos collection at render time. Aspect ratio: {aspectRatio}.
      </CaptionNote>
    </StockPreviewFrame>
  );
}

function PreviewArrow({ side }: { side: "left" | "right" }): ReactNode {
  const positional: React.CSSProperties =
    side === "left" ? { left: "0.5rem" } : { right: "0.5rem" };
  return (
    <span
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.75rem",
        height: "1.75rem",
        borderRadius: "9999px",
        background: "rgba(0,0,0,0.5)",
        color: "#ffffff",
        fontSize: "0.875rem",
        lineHeight: 1,
        ...positional,
      }}
      aria-hidden
    >
      {side === "left" ? "\u2039" : "\u203A"}
    </span>
  );
}

/**
 * Convert a carousel aspect ratio to a `padding-top` percentage so the
 * preview frame keeps its shape without needing to juggle `aspect-ratio`
 * support inside Keystatic's admin shell (where the CSS environment is
 * less controllable than on the site itself).
 *
 * `auto` falls back to 4:3 for the preview — we don't know the image's
 * intrinsic aspect in the admin, so showing a reasonable shape beats
 * leaving the frame empty.
 */
function aspectRatioToPadding(ratio: CarouselAspectRatio): string {
  switch (ratio) {
    case "16/9":
      return "56.25%"; // 9/16
    case "4/3":
      return "75%"; // 3/4
    case "1/1":
      return "100%";
    case "auto":
      return "75%"; // preview fallback; live renderer uses intrinsic
    default:
      // TypeScript should ensure exhaustiveness; fall back if not.
      return "56.25%";
  }
}

