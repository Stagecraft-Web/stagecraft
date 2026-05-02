import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  POSTS_LIST_LAYOUTS,
  POSTS_LIST_LAYOUT_LABELS,
} from "../_shared/types";
import { PostsListPreview } from "./preview";
import { POST_CATEGORIES, type PostCategory } from "../../lib/schemas";

/**
 * Re-export from `_shared/types` so `PostsList.astro` can continue to
 * `import type { PostsListLayout } from "./schema"` without knowing where
 * the canonical const lives.
 */
export type PostsListLayout = (typeof POSTS_LIST_LAYOUTS)[number];

/**
 * Category filter options for the PostsList block. `"all"` shows every
 * category; the other values correspond 1:1 with POST_CATEGORIES.
 *
 * This union is specific to the block (it combines the `all` sentinel with
 * POST_CATEGORIES) and isn't duplicated elsewhere, so it stays here rather
 * than moving to `_shared/types.ts`.
 */
export type PostsListFilter = "all" | PostCategory;

const FILTER_OPTIONS: readonly PostsListFilter[] = ["all", ...POST_CATEGORIES];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/PostsList/PostsList.astro",
  selfClosing: true,
  attributes: {
    limit: { type: Number },
    category: {
      type: String,
      default: "all",
      matches: [...FILTER_OPTIONS],
    },
    layout: {
      type: String,
      default: "grid",
      matches: [...POSTS_LIST_LAYOUTS],
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Posts List",
  description:
    "Embeds a grid or list of posts from the Posts collection. Sorted by publish date (newest first). Optionally filter by category and cap the count.",
  schema: {
    limit: fields.integer({
      label: "Limit (max posts shown)",
      description: "Leave blank to show every post.",
      validation: { min: 1 },
    }),
    category: fields.select({
      label: "Category filter",
      options: FILTER_OPTIONS.map((c) => ({
        label: c === "all" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1),
        value: c,
      })) as [
        { label: string; value: PostsListFilter },
        ...{ label: string; value: PostsListFilter }[],
      ],
      defaultValue: "all",
    }),
    layout: fields.select({
      label: "Layout",
      options: POSTS_LIST_LAYOUTS.map((v) => ({
        label: POSTS_LIST_LAYOUT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: PostsListLayout },
        ...{ label: string; value: PostsListLayout }[],
      ],
      defaultValue: "grid",
    }),
  },
  ContentView: PostsListPreview,
});

// Tag name is two-segment kebab to stay in @astrojs/markdoc's safe zone —
// `toImportName` only replaces the first dash, so 3-segment names would
// produce invalid JS identifiers at build time.
export const tagName = "posts-list";
