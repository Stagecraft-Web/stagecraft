/**
 * Parse YAML-like frontmatter from a raw markdown string.
 * Returns an object of key-value pairs from the `---` delimited block.
 */
export function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  return Object.fromEntries(
    match[1]
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split(": ");
        return [key.trim(), rest.join(": ").trim()];
      })
  );
}

/**
 * Extract the body content from a raw markdown string, stripping frontmatter.
 * Splits on double newlines into paragraphs.
 */
export function parseBody(raw: string): string[] {
  const body = raw.replace(/^---[\s\S]*?---\n*/, "").trim();
  return body.split("\n\n").filter(Boolean);
}
