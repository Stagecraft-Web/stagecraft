import type { ReactNode } from "react";
import { Children } from "react";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
  previewText,
  previewTextMuted,
  labelStyle,
} from "../_shared/previewTokens";
import type { DownloadsLayout } from "../_shared/types";

type DownloadsValue = {
  title: string;
  layout: DownloadsLayout;
};

/**
 * Wrapper preview. Renders a framed container that lists its Download children
 * inline. Shows the count of children in the header so authors get fast
 * feedback that items are being picked up.
 *
 * Inline hex per the admin-shell preview pattern (Keystatic admin doesn't load
 * the site's global.css, so --color-* variables won't resolve).
 */
export function DownloadsPreview({
  value,
  children,
}: {
  value: DownloadsValue;
  children: ReactNode;
}): ReactNode {
  const count = Children.count(children);
  const { title, layout } = value;
  const isGrid = layout === "grid";

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBgMuted,
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.625rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>Downloads</div>
          {title && (
            <div
              style={{
                marginTop: "0.125rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: previewText,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            color: previewTextMuted,
            whiteSpace: "nowrap",
          }}
        >
          {count} item{count === 1 ? "" : "s"}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: isGrid
            ? "repeat(auto-fill, minmax(160px, 1fr))"
            : "1fr",
        }}
      >
        {children}
      </div>
    </div>
  );
}
