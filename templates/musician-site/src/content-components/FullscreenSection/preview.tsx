import type { ReactNode } from "react";
import { useBlobObjectUrl, type KeystaticImageBlob } from "../_shared/keystaticImage";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { PlaceholderImage } from "../_shared/previewChrome";

type FullscreenSectionValue = {
  title: string;
  headingLevel: "h1" | "h2" | "h3" | "h4";
  isTitleHidden: boolean;
  image: KeystaticImageBlob;
};

export function FullscreenSectionPreview({
  value,
  children,
}: {
  value: FullscreenSectionValue;
  children: ReactNode;
}): ReactNode {
  const { title, image, isTitleHidden } = value;
  const imageUrl = useBlobObjectUrl(image);
  const hasImage = imageUrl !== null;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: previewRadius,
        overflow: "hidden",
        border: previewBorder,
        minHeight: "220px",
        background: hasImage ? "#000000" : previewBgMuted,
      }}
    >
      {hasImage ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.7,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: previewTextMuted,
            fontSize: "0.75rem",
          }}
        >
          <PlaceholderImage label="No background image" height={220} isFullBleed />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          padding: "0.125rem 0.5rem",
          background: "rgba(0, 0, 0, 0.65)",
          color: "#ffffff",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          borderRadius: "3px",
        }}
      >
        Fullscreen Section
      </div>
      <div
        style={{
          position: "relative",
          padding: "3rem 1.5rem 2rem",
          color: hasImage ? "#ffffff" : previewText,
          textShadow: hasImage ? "0 1px 3px rgba(0,0,0,0.6)" : undefined,
        }}
      >
        {title && !isTitleHidden && (
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: "0.5rem",
              fontFamily: "Georgia, serif",
            }}
          >
            {title}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
