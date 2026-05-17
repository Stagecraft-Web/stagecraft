/**
 * Filesystem helpers shared by every content-store layer (pages,
 * singletons, collections) and the publish flow.
 *
 *   - `contentDir()` resolves the content root, honouring the
 *     `STAGECRAFT_CONTENT_DIR` env override so parallel test files can
 *     isolate per-worker tmpdirs.
 *   - `localPathForRepoPath()` is the canonical "repo path →
 *     local filesystem path" conversion. Stores and the publish flow
 *     share it so write paths stay consistent across both paths.
 *   - `readJson` returns `null` on ENOENT (not throws) so callers can
 *     fall back to defaults without try/catch around every read.
 *   - `stringifyContent` is the canonical serializer (2-space indent +
 *     trailing newline) so re-saves produce minimal diffs.
 */

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Every repo-relative path we write today lives under this prefix
 * (pages, singletons, collections). Files outside `src/content/` are
 * mapped relative to the repo root — kept open for future targets
 * like committed image variants under `public/`.
 */
export const REPO_CONTENT_PREFIX = "src/content/";

export function contentDir(): string {
  return process.env.STAGECRAFT_CONTENT_DIR ?? path.join(process.cwd(), "src/content");
}

/**
 * Map a `src/content/...` repo path to its local filesystem path,
 * honouring `STAGECRAFT_CONTENT_DIR`. The publish flow and the
 * filesystem stores both go through here so a single source dictates
 * where content lives on disk.
 */
export function localPathForRepoPath(repoPath: string): string {
  if (repoPath.startsWith(REPO_CONTENT_PREFIX)) {
    return path.join(contentDir(), repoPath.slice(REPO_CONTENT_PREFIX.length));
  }
  return path.join(process.cwd(), repoPath);
}

export function stringifyContent(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

export function isNotFound(cause: unknown): boolean {
  return Boolean(
    cause &&
      typeof cause === "object" &&
      "code" in cause &&
      (cause as { code: string }).code === "ENOENT",
  );
}

export async function readJson<T>(file: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
  // A zero-byte file isn't a valid JSON payload but isn't worth crashing
  // the public renderer over either — treat it the same as missing and
  // let the caller fall back to its default. Persists across restarts of
  // a half-failed write.
  if (raw.trim().length === 0) return null;
  return JSON.parse(raw) as T;
}

/**
 * Write a UTF-8 string to `file`, creating parent directories as
 * needed. The mkdir+writeFile pair is repeated across every store that
 * persists files; centralising avoids forgetting one.
 */
export async function writeText(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf-8");
}

/**
 * Write `value` to `file` with canonical JSON formatting. Equivalent to
 * `writeText(file, stringifyContent(value))`; preferred over the raw
 * pair so re-saves keep diffing minimally.
 */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await writeText(file, stringifyContent(value));
}

/**
 * `unlink` that swallows ENOENT — useful when the caller's intent is
 * "make sure this file is gone" rather than "delete this specific file
 * that I know is there." The store layers all delete this way.
 */
export async function unlinkIfExists(file: string): Promise<void> {
  try {
    await fs.unlink(file);
  } catch (cause) {
    if (!isNotFound(cause)) throw cause;
  }
}

/**
 * Read a directory and return the values from `pick` that aren't null.
 * Treats ENOENT as an empty directory so callers don't branch on
 * "directory might not exist yet." Result is sorted alphabetically.
 *
 * Used to enumerate collections, items, etc. — wherever the pattern is
 * "list directory entries that match a slug shape."
 */
export async function readdirFiltered<T extends string>(
  dir: string,
  pick: (entry: import("node:fs").Dirent) => T | null,
): Promise<T[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if (isNotFound(cause)) return [];
    throw cause;
  }
  const out: T[] = [];
  for (const entry of entries) {
    const value = pick(entry);
    if (value !== null) out.push(value);
  }
  return out.sort();
}
