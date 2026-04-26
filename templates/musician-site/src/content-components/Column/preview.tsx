import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
} from "../_shared/previewTokens";
import { CaptionNote } from "../_shared/previewChrome";
import type { TextAlignment } from "../_shared/types";
import { TEXT_ALIGNMENT_LABELS } from "../_shared/types";

type ColumnValue = {
  textAlign: TextAlignment;
};

export function ColumnPreview({
  value,
  children,
}: {
  value: ColumnValue;
  children: ReactNode;
}): ReactNode {
  const { textAlign } = value;
  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.5rem 0.75rem",
        minHeight: "3rem",
        textAlign,
      }}
    >
      {children}
      {textAlign !== "start" && (
        <CaptionNote>
          Alignment: {TEXT_ALIGNMENT_LABELS[textAlign] ?? textAlign}
        </CaptionNote>
      )}
    </div>
  );
}
