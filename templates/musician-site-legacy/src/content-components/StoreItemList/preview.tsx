import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
  previewText,
  previewTextMuted,
} from "../_shared/previewTokens";
import { StockPreviewFrame, CaptionNote } from "../_shared/previewChrome";

// Stock 3-card mock — the real list is populated from the Store Items
// collection at render time, but this gives the editor a shape-accurate
// preview (image + format badge + price + button) so the block is
// recognisable in the Markdoc editor.
const mockItems: ReadonlyArray<{
  title: string;
  format: string;
  price: string;
  badge?: "preorder";
}> = [
  { title: "Album Title", format: "Album · Vinyl", price: "$25" },
  { title: "EP Name", format: "EP · Digital", price: "$8", badge: "preorder" },
  { title: "Tee", format: "Merch", price: "$30" },
];

export function StoreItemListPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Store · 3 items">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
        }}
      >
        {mockItems.map((item) => (
          <div
            key={item.title}
            style={{
              border: previewBorder,
              borderRadius: previewRadius,
              background: previewBg,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                background:
                  "linear-gradient(135deg, #e4e4e7 0%, #d4d4d8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: previewTextMuted,
              }}
            >
              <BoxIcon />
              {item.badge === "preorder" && (
                <span
                  style={{
                    position: "absolute",
                    top: "0.25rem",
                    left: "0.25rem",
                    padding: "0.125rem 0.375rem",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderRadius: "3px",
                    background: "#2563eb",
                    color: "#ffffff",
                  }}
                >
                  Preorder
                </span>
              )}
            </div>
            <div
              style={{
                padding: "0.5rem 0.625rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  color: previewTextMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {item.format}
              </span>
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
                {item.title}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: previewText,
                }}
              >
                {item.price}
              </div>
              <div
                style={{
                  marginTop: "0.25rem",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#18181b",
                  borderRadius: "3px",
                  textAlign: "center",
                }}
              >
                Buy
              </div>
            </div>
          </div>
        ))}
      </div>
      <CaptionNote>Populated from your Store Items collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}

function BoxIcon(): ReactNode {
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
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
