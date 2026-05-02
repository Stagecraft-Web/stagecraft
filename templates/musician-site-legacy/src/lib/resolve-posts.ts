/**
 * Pure helpers for turning a list of post entries into the ordered, filtered
 * subset a list view actually wants to render.
 *
 * Kept out of PostsList.astro so the sort/filter/limit logic can be unit
 * tested without pulling in the Astro content runtime. The input shape is the
 * minimal surface we need (id + frontmatter fields) so tests can construct
 * fixtures without fabricating full CollectionEntry objects.
 */
import type { PostCategory, PostStatus } from "./schemas";

export interface ResolvablePost {
  id: string;
  data: {
    title: string;
    publishedDate: string;
    category: PostCategory;
    status: PostStatus;
    excerpt?: string;
    externalUrl?: string;
    featuredImage?: unknown;
  };
}

export type PostsListFilterCategory = "all" | PostCategory;

export interface ResolvePostsOptions {
  /**
   * "all" includes every category; otherwise only posts matching the named
   * category are returned. Defaults to "all".
   */
  category?: PostsListFilterCategory;
  /**
   * Upper bound on the number of posts returned. Missing / zero / negative
   * values are treated as "no limit".
   */
  limit?: number;
  /**
   * When true (default), only `status === "published"` posts are returned.
   * The `/news/[slug]` route and `posts-list` block both set this. Unit tests
   * can opt out.
   */
  publishedOnly?: boolean;
}

/**
 * Filter, sort (publishedDate desc), and limit a collection of posts. Pure —
 * does not mutate its input.
 *
 * Sort is stable: posts with identical `publishedDate` retain input order,
 * which lets callers upstream of this function impose a secondary sort (e.g.
 * by title) by pre-sorting before calling.
 */
export function resolvePosts<T extends ResolvablePost>(
  posts: readonly T[],
  options: ResolvePostsOptions = {},
): T[] {
  const {
    category = "all",
    limit,
    publishedOnly = true,
  } = options;

  const filtered = posts.filter((post) => {
    if (publishedOnly && post.data.status !== "published") return false;
    if (category !== "all" && post.data.category !== category) return false;
    return true;
  });

  // Sort descending by ISO date string. Because publishedDate is validated as
  // YYYY-MM-DD, lexicographic comparison is equivalent to chronological —
  // no Date parsing needed.
  const sorted = [...filtered].sort((a, b) => {
    if (a.data.publishedDate < b.data.publishedDate) return 1;
    if (a.data.publishedDate > b.data.publishedDate) return -1;
    return 0;
  });

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
}

/**
 * Derive the URL a post card should link to: external if set, otherwise the
 * internal detail page at `/news/<slug>`. The slug is derived from the entry
 * id with any `.mdoc` suffix stripped (Astro's glob loader normally drops
 * the extension, but we strip defensively so upstream changes in the loader
 * don't silently break links).
 */
export function getPostHref(post: ResolvablePost): string {
  if (post.data.externalUrl) return post.data.externalUrl;
  const slug = post.id.replace(/\.mdoc$/, "");
  return `/news/${slug}`;
}

/** True when the card's link should open in a new tab. */
export function isPostExternal(post: ResolvablePost): boolean {
  return typeof post.data.externalUrl === "string" && post.data.externalUrl.length > 0;
}
