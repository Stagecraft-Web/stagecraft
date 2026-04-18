import type { ReactNode } from "react";
import { parseColumnsLayout } from "../_shared/parseColumnsLayout";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
} from "../_shared/previewTokens";

type ColumnsValue = { layout: string };

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
