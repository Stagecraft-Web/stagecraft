import { describe, it, expect, vi } from "vitest";

// edit-site.ts has module-level imports with side effects (Prisma, queue) —
// mock them so we can import and test the pure utility functions in isolation.
vi.mock("@stagecraft/db", () => ({ prisma: {} }));
vi.mock("@stagecraft/queue", () => ({}));
vi.mock("@stagecraft/shared", () => ({}));
vi.mock("@/lib/integrations/github", () => ({}));

const { injectFrontmatterField } = await import("../jobs/edit-site");

describe("injectFrontmatterField", () => {
  it("inserts a new key into existing frontmatter", () => {
    const content = "---\ntitle: About\n---\n\nHello world.";
    const result = injectFrontmatterField(content, "photo", "/assets/images/me.jpg");
    expect(result).toContain("photo: /assets/images/me.jpg");
    expect(result).toContain("title: About");
    expect(result).toContain("Hello world.");
  });

  it("replaces an existing key in frontmatter", () => {
    const content = "---\ntitle: About\nphoto: /old.jpg\n---\n\nBody.";
    const result = injectFrontmatterField(content, "photo", "/new.jpg");
    expect(result).toContain("photo: /new.jpg");
    expect(result).not.toContain("/old.jpg");
    // Key appears exactly once
    expect(result.match(/^photo:/gm)?.length).toBe(1);
  });

  it("prepends frontmatter when none exists", () => {
    const content = "Just some body text.";
    const result = injectFrontmatterField(content, "photo", "/image.jpg");
    expect(result.startsWith("---\n")).toBe(true);
    expect(result).toContain("photo: /image.jpg");
    expect(result).toContain("Just some body text.");
  });

  it("preserves the rest of the body after frontmatter", () => {
    const content = "---\ntitle: My Page\n---\n\n## Section\n\nContent here.";
    const result = injectFrontmatterField(content, "image", "/img.png");
    expect(result).toContain("## Section");
    expect(result).toContain("Content here.");
  });

  it("handles empty frontmatter block", () => {
    const content = "---\n\n---\n\nBody.";
    const result = injectFrontmatterField(content, "key", "value");
    expect(result).toContain("key: value");
  });
});
