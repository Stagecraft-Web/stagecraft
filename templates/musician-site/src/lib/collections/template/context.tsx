/**
 * Item context for the template renderer.
 *
 * The TemplateRenderer wraps the rendered tree in this context so every
 * block component can call `useItemContext()` to get the current item
 * (for resolving Bindables) and the collection definition (for
 * type-checking bindings when needed).
 *
 * `currentItemId` and `currentItemField` filter clauses (§5.1) resolve
 * against the same context when Collection blocks land in PR 7.
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { CollectionDef, Item } from "../schema";

export type ItemContextValue = {
  item: Item;
  collection: CollectionDef;
};

const ItemContext = createContext<ItemContextValue | null>(null);

export function ItemProvider({
  item,
  collection,
  children,
}: ItemContextValue & { children: ReactNode }) {
  return <ItemContext.Provider value={{ item, collection }}>{children}</ItemContext.Provider>;
}

/**
 * Get the current item being rendered. Throws if used outside a
 * `TemplateRenderer` / `ItemProvider` — block components are only meant
 * to render inside one.
 */
export function useItemContext(): ItemContextValue {
  const ctx = useContext(ItemContext);
  if (!ctx) {
    throw new Error(
      "useItemContext: must be called inside <TemplateRenderer> / <ItemProvider>",
    );
  }
  return ctx;
}
