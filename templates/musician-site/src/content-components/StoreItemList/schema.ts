import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
  StoreItemFilter,
  StoreItemLayout,
} from "../_shared/types";
import { StoreItemListPreview } from "./preview";

const STORE_ITEM_FILTERS: readonly StoreItemFilter[] = ["all", "available", "preorder"];
const STORE_ITEM_LAYOUTS: readonly StoreItemLayout[] = ["grid", "list"];

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/StoreItemList/StoreItemList.astro",
  selfClosing: true,
  attributes: {
    filter: {
      type: String,
      default: "available",
      matches: [...STORE_ITEM_FILTERS],
    },
    layout: {
      type: String,
      default: "grid",
      matches: [...STORE_ITEM_LAYOUTS],
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
      options: [
        { label: "Available only", value: "available" },
        { label: "All (including sold-out)", value: "all" },
        { label: "Preorders only", value: "preorder" },
      ],
      defaultValue: "available",
    }),
    layout: fields.select({
      label: "Layout",
      description:
        "Grid is best for cover-led merch walls; list is compact and works well for digital-only catalogues.",
      options: [
        { label: "Grid", value: "grid" },
        { label: "List", value: "list" },
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
