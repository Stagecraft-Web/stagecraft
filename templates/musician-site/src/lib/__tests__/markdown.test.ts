import { describe, it, expect } from "vitest";
import { parseFrontmatter, parseBody } from "../markdown";

const SAMPLE = `---
headline: About the Artist
subtitle: A brief bio
---

First paragraph of the bio.

Second paragraph with more details.

Third paragraph wrapping up.`;

describe("parseFrontmatter", () => {
  it("extracts key-value pairs from frontmatter block", () => {
    expect(parseFrontmatter(SAMPLE)).toEqual({
      headline: "About the Artist",
      subtitle: "A brief bio",
    });
  });

  it("returns empty object when no frontmatter exists", () => {
    expect(parseFrontmatter("Just some text")).toEqual({});
  });

  it("handles values containing colons", () => {
    const raw = `---
title: Time: A Story
---

Body.`;
    expect(parseFrontmatter(raw)).toEqual({ title: "Time: A Story" });
  });
});

describe("parseBody", () => {
  it("strips frontmatter and splits into paragraphs", () => {
    expect(parseBody(SAMPLE)).toEqual([
      "First paragraph of the bio.",
      "Second paragraph with more details.",
      "Third paragraph wrapping up.",
    ]);
  });

  it("handles content with no frontmatter", () => {
    expect(parseBody("Just one paragraph.")).toEqual(["Just one paragraph."]);
  });

  it("filters out empty paragraphs", () => {
    const raw = `---
title: Test
---

Para one.



Para two.`;
    expect(parseBody(raw)).toEqual(["Para one.", "Para two."]);
  });
});
