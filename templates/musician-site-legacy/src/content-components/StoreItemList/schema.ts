import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  STORE_ITEM_LIST_FILTERS,
  STORE_ITEM_LIST_LAYOUTS,
  type StoreItemListFilter,
  type StoreItemListLayout,
} from "../../lib/schemas";
import { StoreItemListPreview } from "./preview";

// Filter and layout labels are local because they aren't reused elsewhere —
// the schemas.ts constants are the list of values; the display strings are a
// block-specific concern (sold-out copy etc.).
const FILTER_LABELS: Record<StoreItemListFilter, string> = {
  all: "All (including sold-out)",
  available: "Available only",
  preorder: "Preorders only",
};

const LAYOUT_LABELS: Record<StoreItemListLayout, string> = {
  grid: "Grid",
  list: "List",
};

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/StoreItemList/StoreItemList.astro",
  selfClosing: true,
  attributes: {
    filter: {
      type: String,
      default: "available",
      matches: [...STORE_ITEM_LIST_FILTERS],
    },
    layout: {
      type: String,
      default: "grid",
      matches: [...STORE_ITEM_LIST_LAYOUTS],
    },
  },
};

export const keystatic: KeystaticContentComponent = block({
  label: "Store Items",
  description:
    "Displays entries from the Store Items collection as a grid or list of buyable cards. " +
    "By default only available items are shown (sold-out items are hidden).",
  schema: {
    filter: fields.select({
      label: "Filter",
      description:
        "Which items to include. 'Available only' hides sold-out items (the common default); 'All' shows sold-out items with a grayed-out badge; 'Preorders only' is for launch pages.",
      options: STORE_ITEM_LIST_FILTERS.map((v) => ({
        label: FILTER_LABELS[v],
        value: v,
      })) as [
        { label: string; value: StoreItemListFilter },
        ...{ label: string; value: StoreItemListFilter }[],
      ],
      defaultValue: "available",
    }),
    layout: fields.select({
      label: "Layout",
      description:
        "Grid is best for cover-led merch walls; list is compact and works well for digital-only catalogues.",
      options: STORE_ITEM_LIST_LAYOUTS.map((v) => ({
        label: LAYOUT_LABELS[v],
        value: v,
      })) as [
        { label: string; value: StoreItemListLayout },
        ...{ label: string; value: StoreItemListLayout }[],
      ],
      defaultValue: "grid",
    }),
  },
  ContentView: StoreItemListPreview,
});

// Tag name uses two segments (no 3-segment kebab) because @astrojs/markdoc's
// internal `toImportName` helper only replaces the first dash in a tag name
// when generating a JS identifier. A three-segment name like
// "store-item-list" produces an invalid identifier and breaks the build.
// Mirrors the `tour-dates` cadence.
export const tagName = "store-items";
