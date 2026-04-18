/**
 * Rich preview renderers for Keystatic content components.
 *
 * These are the `ContentView` callbacks passed to block/wrapper components
 * defined in keystatic.config.ts. They render inside Keystatic's admin shell
 * (the /keystatic route), which does NOT load the site's global.css. Because
 * of that, these components use inline styles with hardcoded neutral colors
 * that look good against Keystatic's default light background. We intentionally
 * do not reference --color-* CSS variables from the site design system here.
 */
import { useEffect, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

/**
 * In the Keystatic editor, image fields surface their value as either
 * `null` or `{ data: Uint8Array; extension: string; filename: string }`
 * while the user is editing. To render a real preview, convert that blob
 * to a browser object URL. (Persisted values on reload arrive the same way
 * after Keystatic reads the file back from disk.)
 */
type KeystaticImageBlob = {
  data: Uint8Array;
  extension: string;
  filename: string;
} | null;

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

function useBlobObjectUrl(blob: KeystaticImageBlob): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const mime = EXTENSION_MIME[blob.extension.toLowerCase()] ?? "application/octet-stream";
    // Copy into a fresh ArrayBuffer so TS is happy with BlobPart typing
    // (blob.data.buffer can be SharedArrayBuffer in some typings).
    const copy = new Uint8Array(blob.data.byteLength);
    copy.set(blob.data);
    const objectUrl = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}

// ---------------------------------------------------------------------------
// Shared tokens for previews (scoped to this file so there's one source)
// ---------------------------------------------------------------------------

const previewBorder = "1px solid #d4d4d8";
const previewBorderStrong = "1px solid #a1a1aa";
const previewBg = "#ffffff";
const previewBgMuted = "#f4f4f5";
const previewText = "#18181b";
const previewTextMuted = "#71717a";
const previewAccent = "#2563eb";
const previewRadius = "6px";

const labelStyle: CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: previewTextMuted,
};

// ---------------------------------------------------------------------------
// Columns — renders children in a CSS grid matching the layout prop
// ---------------------------------------------------------------------------

type ColumnsValue = { layout: string };

/**
 * Convert a dash-separated layout string (e.g. "1-2") into a valid
 * CSS `grid-template-columns` value (e.g. "1fr 2fr").
 *
 * - Blank / missing input falls back to "1fr 1fr".
 * - Non-numeric or non-positive tracks are dropped; if nothing valid
 *   remains the fallback is used.
 */
export function parseColumnsLayout(raw: string | null | undefined): string {
  const layout = (raw ?? "").trim() || "1-1";
  const tracks = layout
    .split("-")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return tracks.length > 0 ? tracks.map((n) => `${n}fr`).join(" ") : "1fr 1fr";
}

export function ColumnsPreview({
  value,
  children,
}: {
  value: ColumnsValue;
  children: ReactNode;
}): ReactNode {
  const gridTemplateColumns = parseColumnsLayout(value.layout);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: "0.75rem",
        padding: "0.5rem",
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBgMuted,
      }}
    >
      {children}
    </div>
  );
}

// The wrapper for a single Column inside Columns — just a bordered box.
export function ColumnPreview({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.5rem 0.75rem",
        minHeight: "3rem",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image — shows the actual uploaded image with fallback placeholder
// ---------------------------------------------------------------------------

type ImageValue = { src: KeystaticImageBlob; alt: string };

export function ImagePreview({ value }: { value: ImageValue }): ReactNode {
  const { src, alt } = value;
  const url = useBlobObjectUrl(src);
  const hasSrc = url !== null;

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.5rem",
        textAlign: "center",
      }}
    >
      {hasSrc ? (
        <img
          src={url}
          alt={alt}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "200px",
            margin: "0 auto",
            objectFit: "contain",
            borderRadius: "4px",
          }}
        />
      ) : (
        <PlaceholderImage label="No image selected" height={120} />
      )}
      {alt && (
        <div
          style={{
            marginTop: "0.375rem",
            fontSize: "0.75rem",
            color: previewTextMuted,
            fontStyle: "italic",
          }}
        >
          {alt}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen section — background image with overlay content on top
// ---------------------------------------------------------------------------

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
          <PlaceholderImage label="No background image" height={220} full />
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

// ---------------------------------------------------------------------------
// Button — styled button preview
// ---------------------------------------------------------------------------

type ButtonValue = {
  label: string;
  href: string;
  variant: "primary" | "outline";
  isExternal: boolean;
};

export function ButtonPreview({ value }: { value: ButtonValue }): ReactNode {
  const { label, href, variant, isExternal } = value;
  const isPrimary = variant === "primary";

  const buttonStyle: CSSProperties = isPrimary
    ? {
        background: previewAccent,
        color: "#ffffff",
        border: `1px solid ${previewAccent}`,
      }
    : {
        background: "transparent",
        color: previewText,
        border: `2px solid ${previewText}`,
      };

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "0.25rem",
        padding: "0.5rem",
      }}
    >
      <span
        style={{
          ...buttonStyle,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.5rem 1rem",
          borderRadius: previewRadius,
          fontWeight: 600,
          fontSize: "0.875rem",
          lineHeight: 1,
        }}
      >
        {label || "Button"}
        {isExternal && <ExternalLinkIcon />}
      </span>
      {href && (
        <span
          style={{
            fontSize: "0.6875rem",
            color: previewTextMuted,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          }}
        >
          → {href}
        </span>
      )}
    </div>
  );
}

function ExternalLinkIcon(): ReactNode {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Release list — 3 mock release cards
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Photo gallery — 3x2 grid of placeholders
// ---------------------------------------------------------------------------

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

function ImageIcon(): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Press quotes — 2 styled quote cards
// ---------------------------------------------------------------------------

const mockQuotes: ReadonlyArray<{ quote: string; attribution: string }> = [
  {
    quote: "An unforgettable performance that stays with you long after the last note.",
    attribution: "Publication Name",
  },
  {
    quote: "A bold new voice in contemporary music — original, confident, and deeply moving.",
    attribution: "Critic's Name, Magazine",
  },
];

export function PressQuotesPreview(): ReactNode {
  return (
    <StockPreviewFrame label="Press Quotes">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
      >
        {mockQuotes.map((q) => (
          <blockquote
            key={q.attribution}
            style={{
              margin: 0,
              padding: "0.875rem 1rem",
              border: previewBorder,
              borderLeft: `3px solid ${previewAccent}`,
              borderRadius: previewRadius,
              background: previewBg,
            }}
          >
            <div
              style={{
                fontSize: "0.8125rem",
                fontStyle: "italic",
                color: previewText,
                lineHeight: 1.5,
                marginBottom: "0.5rem",
              }}
            >
              &ldquo;{q.quote}&rdquo;
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: previewTextMuted,
                fontWeight: 500,
              }}
            >
              — {q.attribution}
            </div>
          </blockquote>
        ))}
      </div>
      <CaptionNote>Populated from your Press Quotes collection at render time.</CaptionNote>
    </StockPreviewFrame>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StockPreviewFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      style={{
        border: previewBorderStrong,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.75rem",
      }}
    >
      <div style={{ ...labelStyle, marginBottom: "0.5rem" }}>{label}</div>
      {children}
    </div>
  );
}

function CaptionNote({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        marginTop: "0.5rem",
        fontSize: "0.6875rem",
        color: previewTextMuted,
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

function PlaceholderImage({
  label,
  height,
  full,
}: {
  label: string;
  height: number;
  full?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        height: `${height}px`,
        width: full ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        color: previewTextMuted,
        background: full
          ? "repeating-linear-gradient(45deg, #e4e4e7, #e4e4e7 10px, #f4f4f5 10px, #f4f4f5 20px)"
          : undefined,
        borderRadius: "4px",
      }}
    >
      <ImageIcon />
      <div style={{ fontSize: "0.75rem" }}>{label}</div>
    </div>
  );
}
