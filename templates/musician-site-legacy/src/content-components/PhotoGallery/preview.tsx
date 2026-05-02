import type { ReactNode } from "react";
import { previewRadius } from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote, ImageIcon } from "../_shared/previewChrome";

export function PhotoGalleryPreview(): ReactNode {
  const placeholders = Array.from({ length: 6 });
  return (
    <StockPreviewFrame label="Photo Gallery">
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
              aspectRatio: "4 / 3",
              background: `linear-gradient(135deg, hsl(${(index * 47) % 360} 30% 85%) 0%, hsl(${(index * 47 + 30) % 360} 30% 75%) 100%)`,
              borderRadius: previewRadius,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <ImageIcon />
          </div>
        ))}
      </div>
      <CaptionNote>Populated from your Photos collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}
