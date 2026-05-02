/**
 * In the Keystatic editor, image fields surface their value as either
 * `null` or `{ data: Uint8Array; extension: string; filename: string }`
 * while the user is editing. To render a real preview, we convert that blob
 * to a browser object URL. Persisted values on reload arrive the same way
 * after Keystatic reads the file back from disk.
 */
import { useEffect, useState } from "react";

export type KeystaticImageBlob = {
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

export function useBlobObjectUrl(blob: KeystaticImageBlob): string | null {
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
