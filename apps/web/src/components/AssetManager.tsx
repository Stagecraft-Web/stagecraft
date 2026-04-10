"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import FormGroup from "@/components/FormGroup";
import { USAGE_SLOTS, type UsageSlot } from "@/lib/assets";
import styles from "./AssetManager.module.css";

type UploadStatus = "uploading" | "processing" | "ready" | "committed" | "failed";

interface Asset {
  id: string;
  originalFilename: string;
  normalizedFilename: string;
  mimeType: string;
  fileSize: number;
  uploadStatus: UploadStatus;
  targetRepoPath: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  usageSlot: UsageSlot | null;
  createdAt: string;
}

interface AssetManagerProps {
  siteId: string;
}

type AssetEdit = { alt: string; caption: string; credit: string };

export default function AssetManager({ siteId }: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Per-asset editing state: assetId → { alt, caption, credit }
  const [editingFields, setEditingFields] = useState<Record<string, AssetEdit>>({});
  const [savingAsset, setSavingAsset] = useState<Record<string, boolean>>({});
  const [deletingAsset, setDeletingAsset] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  function seedEditFields(list: Asset[]) {
    setEditingFields((prev) => {
      const next = { ...prev };
      for (const a of list) {
        if (!(a.id in next)) {
          next[a.id] = { alt: a.alt ?? "", caption: a.caption ?? "", credit: a.credit ?? "" };
        }
      }
      return next;
    });
  }

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/assets`);
      if (res.ok) {
        const data = await res.json();
        const list: Asset[] = data.assets ?? [];
        setAssets(list);
        seedEditFields(list);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/sites/${siteId}/assets`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        const a: Asset = data.asset;
        setAssets((prev) => [a, ...prev]);
        setEditingFields((prev) => ({
          ...prev,
          [a.id]: { alt: a.alt ?? "", caption: a.caption ?? "", credit: a.credit ?? "" },
        }));
      } else {
        setUploadError(data.error ?? "Upload failed");
      }
    } catch {
      setUploadError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleSaveAsset(assetId: string) {
    setSavingAsset((prev) => ({ ...prev, [assetId]: true }));
    try {
      const fields = editingFields[assetId];
      const res = await fetch(`/api/sites/${siteId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alt: fields?.alt ?? "",
          caption: fields?.caption ?? "",
          credit: fields?.credit ?? "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...data.asset } : a)));
      }
    } catch {
      // Ignore save failures silently — fields remain editable
    } finally {
      setSavingAsset((prev) => ({ ...prev, [assetId]: false }));
    }
  }

  async function handleSlotChange(assetId: string, val: string) {
    const usageSlot: UsageSlot | null = val ? (val as UsageSlot) : null;
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, usageSlot } : a)));
    try {
      await fetch(`/api/sites/${siteId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usageSlot: val }),
      });
    } catch {
      // Ignore
    }
  }

  async function handleDeleteAsset(assetId: string, filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    setDeletingAsset((prev) => ({ ...prev, [assetId]: true }));
    try {
      const res = await fetch(`/api/sites/${siteId}/assets/${assetId}`, { method: "DELETE" });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    } catch {
      // Ignore
    } finally {
      setDeletingAsset((prev) => ({ ...prev, [assetId]: false }));
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section className={styles.section}>
      <h2>Media</h2>
      <p className={styles.description}>
        Upload images to assign to pages and slots. These will be committed to your site repo when you submit an asset update request.
      </p>

      {/* Drop zone */}
      <div
        className={`${styles.dropzone}${isDragOver ? ` ${styles.dragover}` : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload image — click or drag and drop"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
      >
        {/* Hidden file input — not a labeled form field, triggered programmatically */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
        <span className={styles.dropzoneIcon} aria-hidden>↑</span>
        <span className={styles.dropzoneText}>
          {isUploading ? "Uploading…" : "Click to upload or drag an image here"}
        </span>
        <span className={styles.dropzoneHint}>JPG, PNG, WebP, GIF, SVG · max 10 MB</span>
      </div>

      {uploadError && (
        <p className={styles.uploadError}>{uploadError}</p>
      )}

      {/* Asset list */}
      {isLoading ? (
        <p className={styles.emptyState}>Loading…</p>
      ) : assets.length === 0 ? (
        <p className={styles.emptyState}>No images uploaded yet.</p>
      ) : (
        <ul className={styles.assetList}>
          {assets.map((asset) => (
            <li key={asset.id} className={styles.assetRow}>
              {/* Thumbnail */}
              <div className={styles.thumbnail}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/sites/${siteId}/assets/${asset.id}`}
                  alt={asset.alt ?? asset.originalFilename}
                  className={styles.thumbnailImg}
                  loading="lazy"
                />
              </div>

              {/* Fields */}
              <div className={styles.assetFields}>
                <p className={styles.assetFilename}>
                  {asset.originalFilename}
                  <span className={styles.assetMeta}>{formatBytes(asset.fileSize)}</span>
                  {asset.targetRepoPath && (
                    <span className={styles.assetCommitted} title={asset.targetRepoPath}>
                      committed
                    </span>
                  )}
                </p>

                <FormGroup
                  id={`slot-${asset.id}`}
                  label="Slot"
                  value={asset.usageSlot ?? ""}
                  onChange={(val) => handleSlotChange(asset.id, val)}
                  options={USAGE_SLOTS}
                />

                <FormGroup
                  id={`alt-${asset.id}`}
                  label="Alt text"
                  value={editingFields[asset.id]?.alt ?? ""}
                  onChange={(val) =>
                    setEditingFields((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], alt: val } }))
                  }
                  placeholder="Describe the image for screen readers"
                />

                <FormGroup
                  id={`caption-${asset.id}`}
                  label="Caption"
                  value={editingFields[asset.id]?.caption ?? ""}
                  onChange={(val) =>
                    setEditingFields((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], caption: val } }))
                  }
                  placeholder="Optional caption"
                />

                <FormGroup
                  id={`credit-${asset.id}`}
                  label="Credit"
                  value={editingFields[asset.id]?.credit ?? ""}
                  onChange={(val) =>
                    setEditingFields((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], credit: val } }))
                  }
                  placeholder="Photo credit"
                />

                <div className={styles.assetActions}>
                  <Button
                    size="sm"
                    onClick={() => handleSaveAsset(asset.id)}
                    isDisabled={savingAsset[asset.id]}
                  >
                    {savingAsset[asset.id] ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteAsset(asset.id, asset.originalFilename)}
                    isDisabled={deletingAsset[asset.id]}
                  >
                    {deletingAsset[asset.id] ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
