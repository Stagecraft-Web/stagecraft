/**
 * Filesystem helpers shared by every content-store layer (pages,
 * singletons, collections).
 *
 *   - `contentDir()` resolves the content root, honouring the
 *     `STAGECRAFT_CONTENT_DIR` env override so parallel test files can
 *     isolate per-worker tmpdirs.
 *   - `readJson` returns `null` on ENOENT (not throws) so callers can
 *     fall back to defaults without try/catch around every read.
 *   - `stringifyContent` is the canonical serializer (2-space indent +
 *     trailing newline) so re-saves produce minimal diffs.
 */

import fs from "node:fs/promises";
import path from "node:path";

export function contentDir(): string {
  return process.env.STAGECRAFT_CONTENT_DIR ?? path.join(process.cwd(), "src/content");
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
