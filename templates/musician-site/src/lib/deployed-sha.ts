/**
 * Pull the value of `<meta name="stagecraft-deployed-sha" content="...">`
 * out of an HTML string. Used by the editor's publish-state polling to
 * detect when a freshly committed change has actually been built and
 * served — the meta tag is emitted from `app/layout.tsx` based on the
 * platform's deploy env (`VERCEL_GIT_COMMIT_SHA` / `COMMIT_REF`).
 *
 * Tolerates attribute order and single/double quotes. Returns null when
 * the tag is missing (which happens in the small window between the
 * publish API returning and the new build coming online — caller should
 * keep polling).
 */
export function parseDeployedSha(html: string): string | null {
  // Match either order of `name` and `content` attributes, and either
  // quote style. We only care about the `content` value.
  const patterns = [
    /<meta\s+[^>]*?name=["']stagecraft-deployed-sha["'][^>]*?content=["']([^"']+)["']/i,
    /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?name=["']stagecraft-deployed-sha["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}
