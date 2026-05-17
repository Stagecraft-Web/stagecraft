/**
 * Public entry point for rendering a template against an item.
 *
 * Usage:
 *
 *   <TemplateRenderer template={collection.itemTemplate} item={item} collection={collection} />
 *
 * The renderer walks `template.content` and dispatches each block to
 * the registry — `PRIMITIVE_BLOCKS` by default. PR 7 will provide an
 * extended registry that adds Collection blocks; consumers can pass a
 * custom registry via the `registry` prop.
 *
 * All resolution (Bindables, missing fields, type mismatches) happens
 * inside each block via the item context this component provides.
 */

"use client";

import type { ReactNode } from "react";

import { ItemProvider } from "./context";
import { BlockList, PRIMITIVE_BLOCKS, type BlockRegistry } from "./primitives";
import type { BlockInstance, Template } from "./types";
import type { CollectionDef, Item } from "../schema";

export type TemplateRendererProps = {
  /** The template's Puck JSON (item / detail / list — same shape). */
  template: Template | null;
  /** The item to render against. Used for all binding resolution. */
  item: Item;
  /** The item's collection. Used by future Collection blocks and by debug logging. */
  collection: CollectionDef;
  /**
   * Block registry. Defaults to `PRIMITIVE_BLOCKS`. PR 7 will supply
   * an extended registry including Collection blocks for use inside
   * detailTemplate / listTemplate; itemTemplate renderers should stay
   * on the Primitive-only registry to preserve the §4.3 cycle-safety
   * structural rule.
   */
  registry?: BlockRegistry;
};

export function TemplateRenderer({
  template,
  item,
  collection,
  registry = PRIMITIVE_BLOCKS,
}: TemplateRendererProps): ReactNode {
  if (!template) return null;
  const content = (template.content ?? []) as BlockInstance[];
  return (
    <ItemProvider item={item} collection={collection}>
      <BlockList blocks={content} registry={registry} />
    </ItemProvider>
  );
}
