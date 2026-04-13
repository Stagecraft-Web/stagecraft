import { describe, it, expect } from "vitest";
import { buildMarkdownBody, buildFrontmatter, buildMarkdownPage } from "../content-utils";

// ─── buildMarkdownBody ───────────────────────────────────────────────────────

describe("buildMarkdownBody", () => {
  it("includes paragraphs", () => {
    const body = buildMarkdownBody([], ["First paragraph about me and my music."]);
    expect(body).toContain("First paragraph about me and my music.");
  });

  it("includes secondary headings as h2", () => {
    const body = buildMarkdownBody(["Main Title", "About Section", "Experience"], []);
    expect(body).toContain("## About Section");
    expect(body).toContain("## Experience");
    // First heading (index 0) is skipped — it's the page title used in frontmatter
    expect(body).not.toContain("## Main Title");
  });

  it("returns empty string when no content", () => {
    expect(buildMarkdownBody([], [])).toBe("");
  });

  it("includes up to 3 secondary headings", () => {
    const headings = ["H1", "H2", "H3", "H4", "H5"];
    const body = buildMarkdownBody(headings, []);
    expect(body).toContain("## H2");
    expect(body).toContain("## H3");
    expect(body).toContain("## H4");
    expect(body).not.toContain("## H5");
  });

  it("limits paragraphs to 10", () => {
    const paras = Array.from({ length: 15 }, (_, i) => `Paragraph ${i + 1}.`);
    const body = buildMarkdownBody([], paras);
    expect(body).toContain("Paragraph 10.");
    expect(body).not.toContain("Paragraph 11.");
  });
});

// ─── buildFrontmatter ────────────────────────────────────────────────────────

describe("buildFrontmatter", () => {
  it("produces valid YAML frontmatter block", () => {
    const fm = buildFrontmatter({ title: "About Me", description: "My story." });
    expect(fm).toContain("---");
    expect(fm).toContain('title: "About Me"');
    expect(fm).toContain('description: "My story."');
  });

  it("skips empty values", () => {
    const fm = buildFrontmatter({ title: "Contact", description: "" });
    expect(fm).not.toContain("description:");
  });

  it("escapes internal double-quotes", () => {
    const fm = buildFrontmatter({ title: 'She said "hello"' });
    expect(fm).toContain('\\"hello\\"');
  });

  it("wraps in --- delimiters", () => {
    const fm = buildFrontmatter({ title: "Test" });
    expect(fm.startsWith("---")).toBe(true);
    expect(fm.endsWith("---")).toBe(true);
  });
});

// ─── buildMarkdownPage ───────────────────────────────────────────────────────

describe("buildMarkdownPage", () => {
  it("includes frontmatter and body", () => {
    const md = buildMarkdownPage(
      "About Me",
      "The story of my musical journey.",
      [],
      ["I started playing piano at age 5 and never looked back."]
    );
    expect(md).toContain("---");
    expect(md).toContain("About Me");
    expect(md).toContain("I started playing piano");
  });

  it("returns only frontmatter when body is empty", () => {
    const md = buildMarkdownPage("Home", "", [], []);
    expect(md).toContain("---");
    expect(md.trim().endsWith("---")).toBe(true);
  });

  it("separates frontmatter and body with a blank line", () => {
    const md = buildMarkdownPage("Title", "Desc", [], ["Long enough paragraph content here."]);
    expect(md).toMatch(/---\n\n/);
  });
});
