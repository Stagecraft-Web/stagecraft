import type { ReactNode } from "react";
import {
  previewBorder,
  previewBg,
  previewRadius,
} from "../_shared/previewTokens";
import { CaptionNote } from "../_shared/previewChrome";
import type { CenteredBlockMaxWidth } from "../_shared/types";
import { CENTERED_BLOCK_MAX_WIDTH_LABELS } from "../_shared/types";

type CenteredBlockValue = {
  maxWidth: CenteredBlockMaxWidth;
};

export function CenteredBlockPreview({
  value,
  children,
}: {
  value: CenteredBlockValue;
  children: ReactNode;
}): ReactNode {
  const { maxWidth } = value;
  // Narrow ≈ 60ch ~= 30rem in the admin preview at body font size. Regular
  // maps to the site's --max-text token (~45rem). Numbers here are only
  // for visual approximation in the admin shell.
  const previewMaxWidth = maxWidth === "narrow" ? "30rem" : "45rem";

  return (
    <div
      style={{
        border: previewBorder,
        borderRadius: previewRadius,
        background: previewBg,
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          maxWidth: previewMaxWidth,
          marginInline: "auto",
          textAlign: "center",
        }}
      >
        {children}
      </div>
      <CaptionNote>
        Max width: {CENTERED_BLOCK_MAX_WIDTH_LABELS[maxWidth] ?? maxWidth}
      </CaptionNote>
    </div>
  );
}
