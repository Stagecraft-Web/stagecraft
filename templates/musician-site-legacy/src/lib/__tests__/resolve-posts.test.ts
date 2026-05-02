import { describe, expect, it } from "vitest";
import {
  resolvePosts,
  getPostHref,
  isPostExternal,
  type ResolvablePost,
} from "../resolve-posts";

const make = (
  id: string,
  publishedDate: string,
  overrides: Partial<ResolvablePost["data"]> = {},
): ResolvablePost => ({
  id,
  data: {
    title: id,
    publishedDate,
    category: "news",
    status: "published",
    ...overrides,
  },
});

describe("resolvePosts", () => {
  it("sorts by publishedDate descending", () => {
    const posts = [
      make("a", "2024-01-01"),
      make("b", "2024-06-15"),
      make("c", "2024-03-10"),
    ];
    const result = resolvePosts(posts).map((p) => p.id);
    expect(result).toEqual(["b", "c", "a"]);
  });

  it("filters to published posts by default", () => {
    const posts = [
      make("a", "2024-01-01", { status: "published" }),
      make("b", "2024-02-01", { status: "draft" }),
      make("c", "2024-03-01", { status: "published" }),
    ];
    const ids = resolvePosts(posts).map((p) => p.id);
    expect(ids).toEqual(["c", "a"]);
  });

  it("returns drafts when publishedOnly=false", () => {
    const posts = [
      make("a", "2024-01-01", { status: "draft" }),
      make("b", "2024-02-01", { status: "published" }),
    ];
    const ids = resolvePosts(posts, { publishedOnly: false }).map((p) => p.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("filters by category when set", () => {
    const posts = [
      make("news-1", "2024-04-01", { category: "news" }),
      make("release-1", "2024-05-01", { category: "release" }),
      make("news-2", "2024-06-01", { category: "news" }),
    ];
    const ids = resolvePosts(posts, { category: "news" }).map((p) => p.id);
    expect(ids).toEqual(["news-2", "news-1"]);
  });

  it('treats category="all" as no filter', () => {
    const posts = [
      make("a", "2024-01-01", { category: "news" }),
      make("b", "2024-02-01", { category: "press" }),
    ];
    const ids = resolvePosts(posts, { category: "all" }).map((p) => p.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("applies limit after sort and filter", () => {
    const posts = [
      make("a", "2024-01-01"),
      make("b", "2024-02-01"),
      make("c", "2024-03-01"),
      make("d", "2024-04-01"),
    ];
    const ids = resolvePosts(posts, { limit: 2 }).map((p) => p.id);
    expect(ids).toEqual(["d", "c"]);
  });

  it("ignores non-positive limits (treats as no limit)", () => {
    const posts = [make("a", "2024-01-01"), make("b", "2024-02-01")];
    expect(resolvePosts(posts, { limit: 0 })).toHaveLength(2);
    expect(resolvePosts(posts, { limit: -5 })).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const posts = [make("a", "2024-01-01"), make("b", "2024-02-01")];
    const before = posts.map((p) => p.id);
    resolvePosts(posts);
    expect(posts.map((p) => p.id)).toEqual(before);
  });

  it("returns an empty array when no posts match", () => {
    const posts = [make("a", "2024-01-01", { category: "news" })];
    expect(resolvePosts(posts, { category: "release" })).toEqual([]);
  });
});

describe("getPostHref", () => {
  it("returns the internal /news/<slug> URL by default", () => {
    const post = make("my-post", "2024-01-01");
    expect(getPostHref(post)).toBe("/news/my-post");
  });

  it("strips a trailing .mdoc suffix from the slug", () => {
    // Defensive check: Astro's glob loader currently drops `.mdoc`, but we
    // strip here too so changes upstream don't silently break URLs.
    const post = make("my-post.mdoc", "2024-01-01");
    expect(getPostHref(post)).toBe("/news/my-post");
  });

  it("returns the externalUrl when set", () => {
    const post = make("p", "2024-01-01", {
      externalUrl: "https://example.com/story",
    });
    expect(getPostHref(post)).toBe("https://example.com/story");
  });
});

describe("isPostExternal", () => {
  it("returns true when externalUrl is set", () => {
    const post = make("p", "2024-01-01", {
      externalUrl: "https://example.com/story",
    });
    expect(isPostExternal(post)).toBe(true);
  });

  it("returns false when externalUrl is unset", () => {
    expect(isPostExternal(make("p", "2024-01-01"))).toBe(false);
  });

  it("returns false when externalUrl is an empty string", () => {
    const post = make("p", "2024-01-01", { externalUrl: "" });
    expect(isPostExternal(post)).toBe(false);
  });
});
