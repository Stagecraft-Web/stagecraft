import type { ReactNode } from "react";
import { useBlobObjectUrl, type KeystaticImageBlob } from "../_shared/keystaticImage";
import {
  previewBorder,
  previewBgMuted,
  previewRadius,
  previewTextMuted,
} from "../_shared/previewTokens";
import { PlaceholderImage } from "../_shared/previewChrome";

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
