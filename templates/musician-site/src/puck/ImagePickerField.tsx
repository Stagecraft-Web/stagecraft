"use client";

import { useRef, useState } from "react";

import { type ImageMetadata } from "@/lib/image-types";
import {
  type UploadImageError,
  uploadImageFromClient,
} from "@/lib/upload-image-client";

type Props = {
  value: ImageMetadata | null;
  onChange: (next: ImageMetadata | null) => void;
};

/**
 * Editor-side custom field for image picking.
 *
 * Composes:
 *   1. native `<input type="file">` to grab a File
 *   2. `<input type="text">` for the alt text
 *   3. `uploadImageFromClient` (POSTs to /api/upload-image, returns ImageMetadata)
 *   4. stores the returned ImageMetadata as the field's value
 *
 * Rendered only on the editor side (Puck calls this in the admin UI). The
 * public render path uses the Image block's `render` function with the same
 * `ImageMetadata` value — see puck/config.tsx.
 */
export function ImagePickerField({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [alt, setAlt] = useState(value?.alt ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSrc =
    value && `/images/${value.contentSlug}/${value.id}/${Math.min(800, value.width)}.webp`;

  function reset() {
    setPendingFile(null);
    setAlt(value?.alt ?? "");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!pendingFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const metadata = await uploadImageFromClient({ file: pendingFile, alt });
      onChange(metadata);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cause) {
      const e = cause as UploadImageError;
      setError(e?.message ?? "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    onChange(null);
    reset();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {value && previewSrc ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={value.alt}
            style={{
              maxWidth: "100%",
              height: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "0.25rem",
            }}
          />
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            {value.width}×{value.height} · {value.originalExt} · alt: {value.alt || "(none)"}
          </div>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            Remove image
          </button>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setPendingFile(f);
          setError(null);
        }}
      />
      {pendingFile ? (
        <>
          <label style={{ fontSize: "0.75rem", color: "#374151" }}>
            Alt text (describe the image for screen readers)
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="e.g. Sarah Chen at the Riverside Theater"
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.25rem 0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            style={{
              padding: "0.375rem 0.75rem",
              fontSize: "0.875rem",
              border: "1px solid #111827",
              background: isUploading ? "#9ca3af" : "#111827",
              color: "#ffffff",
              cursor: isUploading ? "wait" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {isUploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
        </>
      ) : null}
      {error ? (
        <div role="alert" style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
