import type { ReactNode } from "react";
import { previewRadius } from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

export function VideoGalleryPreview(): ReactNode {
  const placeholders = Array.from({ length: 6 });
  return (
    <StockPreviewFrame label="Video Gallery">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: "0.5rem",
        }}
      >
        {placeholders.map((_, index) => (
          <div
            key={index}
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              background: `linear-gradient(135deg, hsl(${(index * 53) % 360} 25% 30%) 0%, hsl(${(index * 53 + 30) % 360} 25% 20%) 100%)`,
              borderRadius: previewRadius,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <PlayIcon />
          </div>
        ))}
      </div>
      <CaptionNote>Populated from your Videos collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}

function PlayIcon(): ReactNode {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
      <polygon points="10 8 16 12 10 16 10 8" fill="white" />
    </svg>
  );
}
