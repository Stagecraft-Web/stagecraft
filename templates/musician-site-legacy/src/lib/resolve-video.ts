/**
 * Pre-index every video in src/assets/videos/ at build time.
 *
 * Astro's image pipeline doesn't process videos, so we use Vite's `?url`
 * query to get a fingerprinted public URL for each file. The glob is
 * evaluated statically at build time — every file becomes part of the
 * bundle output regardless of whether it ends up referenced.
 *
 * Mirrors the behavior of `resolve-image.ts` so authors can store the
 * Keystatic-relative path (e.g. "../../assets/videos/hero.mp4") and the
 * renderer transparently resolves it to a hashed asset URL.
 */
// `import: "default"` resolves each module entry to the bare URL string at
// runtime (rather than the usual `{ default: string }` wrapper).
const videoModules = import.meta.glob<string>(
  "/src/assets/videos/**/*.{mp4,webm,mov,m4v}",
  { eager: true, query: "?url", import: "default" },
);

const EXTENSION_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/mp4",
  webm: "video/webm",
};

export type ResolvedVideo = {
  src: string;
  type: string;
};

/**
 * Resolve a relative video path (as stored in Markdoc tag attributes) to a
 * fingerprinted asset URL plus its MIME type. Returns `undefined` if the
 * path is missing or no matching file exists in the indexed glob.
 *
 * Filename matching mirrors `resolveImage`: filenames must be unique across
 * subdirectories of src/assets/videos/.
 */
export function resolveVideo(path: string | undefined): ResolvedVideo | undefined {
  if (!path) return undefined;
  const filename = path.split("/").pop();
  if (!filename) return undefined;
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx < 0) return undefined;
  const extension = filename.slice(dotIdx + 1).toLowerCase();
  const type = EXTENSION_MIME[extension];
  if (!type) return undefined;
  const match = Object.entries(videoModules).find(([key]) =>
    key.endsWith(`/${filename}`),
  );
  const src = match?.[1];
  if (!src) return undefined;
  return { src, type };
}
