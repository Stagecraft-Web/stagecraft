/**
 * Content building utilities — reusable across migration, create-site, and
 * edit-site flows for generating Markdown pages and YAML frontmatter.
 */

/** Convert a list of headings/paragraphs into a basic Markdown body. */
export function buildMarkdownBody(headings: string[], paragraphs: string[]): string {
  const lines: string[] = [];

  // Lead with secondary headings (skip first — it's the page title in frontmatter)
  if (headings.length > 1) {
    for (const h of headings.slice(1, 4)) {
      lines.push(`## ${h}`, "");
    }
  }

  for (const p of paragraphs.slice(0, 10)) {
    lines.push(p, "");
  }

  return lines.join("\n").trimEnd();
}

/** Build a YAML frontmatter block. Empty values are omitted. */
export function buildFrontmatter(fields: Record<string, string>): string {
  const lines = ["---"];
  for (const [key, val] of Object.entries(fields)) {
    if (val) lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
  }
  lines.push("---");
  return lines.join("\n");
}

/** Build a complete Markdown page (frontmatter + body). */
export function buildMarkdownPage(
  title: string,
  description: string,
  headings: string[],
  paragraphs: string[]
): string {
  const fm = buildFrontmatter({ title, description });
  const body = buildMarkdownBody(headings, paragraphs);
  return body ? `${fm}\n\n${body}\n` : `${fm}\n`;
}
