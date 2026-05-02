import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

const mockReleases: ReadonlyArray<{ title: string; year: string }> = [
  { title: "Release Title", year: "2024" },
  { title: "Another Release", year: "2023" },
  { title: "Earlier Work", year: "2022" },
];

export function ReleaseListPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Release List">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
        }}
      >
        {mockReleases.map((release) => (
          <div
            key={release.title}
            style={{
              border: previewBorder,
              borderRadius: previewRadius,
              background: previewBg,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                aspectRatio: "1 / 1",
                background:
                  "linear-gradient(135deg, #e4e4e7 0%, #d4d4d8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: previewTextMuted,
              }}
            >
              <MusicNoteIcon />
            </div>
            <div style={{ padding: "0.5rem 0.625rem" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: previewText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {release.title}
              </div>
              <div style={{ fontSize: "0.75rem", color: previewTextMuted }}>
                {release.year}
              </div>
            </div>
          </div>
        ))}
      </div>
      <CaptionNote>Populated from your Releases collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}

function MusicNoteIcon(): ReactNode {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
