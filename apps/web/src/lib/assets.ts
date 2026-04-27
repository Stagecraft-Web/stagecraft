/**
 * Shared constants and utilities for asset management.
 * Used by API routes and the AssetManager component.
 */

export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/svg+xml";

/** Display options for usage slot selectors */
export const USAGE_SLOTS = [
  { value: "" as const, label: "Unassigned" },
  { value: "hero" as const, label: "Hero / Banner" },
  { value: "gallery" as const, label: "Gallery" },
  { value: "about" as const, label: "About page" },
  { value: "press" as const, label: "Press" },
  { value: "logo" as const, label: "Logo" },
];

export type UsageSlot = Exclude<(typeof USAGE_SLOTS)[number]["value"], "">;

/** Set of valid slot values for API validation (includes "" for unassigned) */
export const VALID_USAGE_SLOTS: ReadonlySet<string> = new Set(USAGE_SLOTS.map((s) => s.value));

/** Shared Prisma select for AssetUpload responses */
export const ASSET_SELECT = {
  id: true,
  originalFilename: true,
  normalizedFilename: true,
  mimeType: true,
  fileSize: true,
  uploadStatus: true,
  targetRepoPath: true,
  alt: true,
  caption: true,
  credit: true,
  usageSlot: true,
  createdAt: true,
} as const;

/**
 * Normalise a user-supplied filename to a safe, lowercase, URL-friendly name
 * with a timestamp suffix to avoid collisions.
 */
export function normalizeFilename(original: string): string {
  const parts = original.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  const base = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const suffix = Date.now();
  return ext ? `${base}-${suffix}.${ext}` : `${base}-${suffix}`;
}
