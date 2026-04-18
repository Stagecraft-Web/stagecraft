import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
} from "../_shared/previewTokens";

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
