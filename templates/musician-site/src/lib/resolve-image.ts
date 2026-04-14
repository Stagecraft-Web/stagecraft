import type { ImageMetadata } from "astro";

/**
 * Pre-index all images in src/assets/images/ at build time.
 * Vite evaluates import.meta.glob statically during the build,
 * so every image file is resolved to an ImageMetadata object with
 * src, width, height, and format.
 */
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/images/**/*.{png,jpg,jpeg,svg,webp,avif,gif}",
  { eager: true },
);

/**
 * Resolve a relative image path (as stored in Markdoc tag attributes
 * or content files) to an optimised Astro ImageMetadata object.
 *
 * Works by extracting the filename from the path and matching it
 * against the pre-indexed image modules. This means filenames must
 * be unique across subdirectories of src/assets/images/.
 */
export function resolveImage(
  path: string | undefined,
): ImageMetadata | undefined {
  if (!path) return undefined;
  const filename = path.split("/").pop();
  if (!filename) return undefined;
  const match = Object.entries(imageModules).find(([key]) =>
    key.endsWith(`/${filename}`),
  );
  return match?.[1]?.default;
}
