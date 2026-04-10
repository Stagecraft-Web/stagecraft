"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import styles from "./AssetManager.module.css";

const USAGE_SLOTS = [
  { value: "", label: "Unassigned" },
  { value: "hero", label: "Hero / Banner" },
  { value: "gallery", label: "Gallery" },
  { value: "about", label: "About page" },
  { value: "press", label: "Press" },
  { value: "logo", label: "Logo" },
];

interface Asset {
  id: string;
  originalFilename: string;
  normalizedFilename: string;
  mimeType: string;
  fileSize: number;
  uploadStatus: string;
  targetRepoPath: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  usageSlot: string | null;
  createdAt: string;
}

interface AssetManagerProps {
  siteId: string;
}

export default function AssetManager({ siteId }: AssetManagerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Per-asset editing state: assetId → field values
  const [editingAlt, setEditingAlt] = useState<Record<string, string>>({});
  const [editingCaption, setEditingCaption] = useState<Record<string, string>>({});
  const [editingCredit, setEditingCredit] = useState<Record<string, string>>({});
  const [savingAsset, setSavingAsset] = useState<Record<string, boolean>>({});
  const [deletingAsset, setDeletingAsset] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/assets`);
      if (res.ok) {
        const data = await res.json();
        const list: Asset[] = data.assets ?? [];
        setAssets(list);
        // Seed editing state for newly-fetched assets
        setEditingAlt((prev) => {
          const next = { ...prev };
          list.forEach((a) => { if (!(a.id in next)) next[a.id] = a.alt ?? ""; });
          return next;
        });
        setEditingCaption((prev) => {
          const next = { ...prev };
          list.forEach((a) => { if (!(a.id in next)) next[a.id] = a.caption ?? ""; });
          return next;
        });
        setEditingCredit((prev) => {
          const next = { ...prev };
          list.forEach((a) => { if (!(a.id in next)) next[a.id] = a.credit ?? ""; });
          return next;
        });
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
        setEditingAlt((prev) => ({ ...prev, [a.id]: a.alt ?? "" }));
        setEditingCaption((prev) => ({ ...prev, [a.id]: a.caption ?? "" }));
        setEditingCredit((prev) => ({ ...prev, [a.id]: a.credit ?? "" }));
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
      const res = await fetch(`/api/sites/${siteId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alt: editingAlt[assetId] ?? "",
          caption: editingCaption[assetId] ?? "",
          credit: editingCredit[assetId] ?? "",
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

  async function handleSlotChange(assetId: string, usageSlot: string) {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, usageSlot: usageSlot || null } : a)));
    try {
      await fetch(`/api/sites/${siteId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usageSlot }),
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
    <section style={{ marginTop: "2rem" }}>
      <h2>Media</h2>
      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: 0, marginBottom: "1rem" }}>
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
        <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", marginTop: "0.5rem" }}>
          {uploadError}
        </p>
      )}

      {/* Asset grid */}
      {isLoading ? (
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "1rem" }}>Loading…</p>
      ) : assets.length === 0 ? (
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "1rem" }}>
          No images uploaded yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
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

                {/* Usage slot selector */}
                <label className={styles.fieldLabel}>
                  Slot
                  <select
                    value={asset.usageSlot ?? ""}
                    onChange={(e) => handleSlotChange(asset.id, e.target.value)}
                    className={styles.slotSelect}
                  >
                    {USAGE_SLOTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>

                {/* Alt text */}
                <label className={styles.fieldLabel}>
                  Alt text
                  <input
                    type="text"
                    value={editingAlt[asset.id] ?? ""}
                    onChange={(e) => setEditingAlt((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                    placeholder="Describe the image for screen readers"
                    className={styles.fieldInput}
                  />
                </label>

                {/* Caption */}
                <label className={styles.fieldLabel}>
                  Caption
                  <input
                    type="text"
                    value={editingCaption[asset.id] ?? ""}
                    onChange={(e) => setEditingCaption((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                    placeholder="Optional caption"
                    className={styles.fieldInput}
                  />
                </label>

                {/* Credit */}
                <label className={styles.fieldLabel}>
                  Credit
                  <input
                    type="text"
                    value={editingCredit[asset.id] ?? ""}
                    onChange={(e) => setEditingCredit((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                    placeholder="Photo credit"
                    className={styles.fieldInput}
                  />
                </label>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
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
