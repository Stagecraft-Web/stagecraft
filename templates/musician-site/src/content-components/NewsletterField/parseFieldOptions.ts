/**
 * Split the pipe-separated `options` attribute of a `{% newsletter-field %}`
 * into a clean list of choices. Markdoc attribute values are flat strings, so
 * we encode select options as `"A|B|C"` rather than introducing fragile
 * array-of-object attribute parsing (see CLAUDE.md rationale in spec §5).
 *
 * Empty/whitespace pieces are dropped so authors can leave trailing pipes or
 * accidental double-pipes (`"A||B|"`) without producing empty <option> rows.
 *
 * Returns an empty array for `undefined`, `null`, or whitespace-only input —
 * lets consumers branch on `list.length === 0` without null checks.
 */
export function parseFieldOptions(raw: string | undefined | null): string[] {
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  return trimmed
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
