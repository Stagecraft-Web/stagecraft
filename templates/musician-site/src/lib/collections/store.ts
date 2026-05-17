/**
 * Filesystem layer for the Collection abstraction.
 *
 * Layout on disk (mirrors ADR-009 §7):
 *
 *   src/content/collections/<collection-slug>/
 *     _collection.json                    # CollectionDef
 *     items/
 *       _order.json                       # OPTIONAL — manual ordering only
 *       _singleton.json                   # OPTIONAL — singletons only
 *       <item-slug>.json                  # one regular item per file
 *
 * Conventions matching the existing `content.ts`:
 *
 *   - `STAGECRAFT_CONTENT_DIR` overrides the content root so test files
 *     can isolate per-worker tmpdirs without clobbering each other.
 *
 *   - Reads return `null` on ENOENT (not throw) so callers can fall back
 *     to defaults instead of branching on errors.
 *
 *   - Writes stringify with `stringifyContent` for canonical formatting
 *     (2-space indent + trailing newline) so re-saves diff minimally.
 *
 *   - Validation happens on both read and write so a corrupt file is
 *     surfaced loudly at read time rather than silently propagating.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { stringifyContent } from "../content";

import {
  ORDER_FILE_NAME,
  SINGLETON_ITEM_SLUG,
  type CollectionDef,
  type FieldDef,
  type Item,
  type ItemFile,
} from "./types";
import {
  buildItemFileSchema,
  collectionDefSchema,
  itemSlugSchema,
  orderFileSchema,
  slugSchema,
} from "./zod";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function contentDir(): string {
  return process.env.STAGECRAFT_CONTENT_DIR ?? path.join(process.cwd(), "src/content");
}

function collectionsDir(): string {
  return path.join(contentDir(), "collections");
}

function collectionDir(collectionSlug: string): string {
  return path.join(collectionsDir(), collectionSlug);
}

function collectionDefPath(collectionSlug: string): string {
  return path.join(collectionDir(collectionSlug), "_collection.json");
}

function itemsDir(collectionSlug: string): string {
  return path.join(collectionDir(collectionSlug), "items");
}

function itemPath(collectionSlug: string, itemSlug: string): string {
  return path.join(itemsDir(collectionSlug), `${itemSlug}.json`);
}

function orderPath(collectionSlug: string): string {
  return path.join(itemsDir(collectionSlug), `${ORDER_FILE_NAME}.json`);
}

/**
 * Repo paths (relative to repo root) for the publish layer.
 *
 * Mirrors the local-path functions above but produces the
 * `src/content/...` form publish targets expect.
 */
export function collectionDefRepoPath(collectionSlug: string): string {
  return `src/content/collections/${collectionSlug}/_collection.json`;
}

export function itemRepoPath(collectionSlug: string, itemSlug: string): string {
  return `src/content/collections/${collectionSlug}/items/${itemSlug}.json`;
}

export function orderRepoPath(collectionSlug: string): string {
  return `src/content/collections/${collectionSlug}/items/${ORDER_FILE_NAME}.json`;
}

// ---------------------------------------------------------------------------
// JSON helpers (duplicated from content.ts intentionally — keeping the
// collections module self-contained pending the PR-3 pages migration that
// will fold both modules together)
// ---------------------------------------------------------------------------

async function readJson<T>(file: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
  if (raw.trim().length === 0) return null;
  return JSON.parse(raw) as T;
}

function isNotFound(cause: unknown): boolean {
  return Boolean(
    cause &&
      typeof cause === "object" &&
      "code" in cause &&
      (cause as { code: string }).code === "ENOENT",
  );
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CollectionNotFoundError extends Error {
  constructor(public collectionSlug: string) {
    super(`No collection with slug "${collectionSlug}"`);
    this.name = "CollectionNotFoundError";
  }
}

export class ItemNotFoundError extends Error {
  constructor(
    public collectionSlug: string,
    public itemSlug: string,
  ) {
    super(`No item "${itemSlug}" in collection "${collectionSlug}"`);
    this.name = "ItemNotFoundError";
  }
}

export class ItemExistsError extends Error {
  constructor(
    public collectionSlug: string,
    public itemSlug: string,
  ) {
    super(`An item with slug "${itemSlug}" already exists in collection "${collectionSlug}"`);
    this.name = "ItemExistsError";
  }
}

// ---------------------------------------------------------------------------
// Collection-level operations
// ---------------------------------------------------------------------------

export async function listCollectionSlugs(): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(collectionsDir(), { withFileTypes: true });
  } catch (cause) {
    if (isNotFound(cause)) return [];
    throw cause;
  }
  return entries
    .filter((e) => e.isDirectory() && slugSchema.safeParse(e.name).success)
    .map((e) => e.name)
    .sort();
}

export async function readCollectionDef(
  collectionSlug: string,
): Promise<CollectionDef | null> {
  slugSchema.parse(collectionSlug);
  const raw = await readJson<unknown>(collectionDefPath(collectionSlug));
  if (raw === null) return null;
  return collectionDefSchema.parse(raw);
}

export async function writeCollectionDef(
  collectionSlug: string,
  def: CollectionDef,
): Promise<void> {
  slugSchema.parse(collectionSlug);
  if (def.slug !== collectionSlug) {
    throw new Error(
      `writeCollectionDef: def.slug (${def.slug}) must match target slug (${collectionSlug})`,
    );
  }
  const parsed = collectionDefSchema.parse(def);
  await fs.mkdir(collectionDir(collectionSlug), { recursive: true });
  await fs.writeFile(
    collectionDefPath(collectionSlug),
    stringifyContent(parsed),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Item operations
// ---------------------------------------------------------------------------

/**
 * Walk `items/` and return the slugs of every regular item file. Reserved
 * filenames (`_singleton`, `_order`) are excluded.
 */
export async function listItemSlugs(collectionSlug: string): Promise<string[]> {
  slugSchema.parse(collectionSlug);
  let entries;
  try {
    entries = await fs.readdir(itemsDir(collectionSlug), { withFileTypes: true });
  } catch (cause) {
    if (isNotFound(cause)) return [];
    throw cause;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name.replace(/\.json$/, ""))
    .filter((slug) => slugSchema.safeParse(slug).success)
    .sort();
}

/**
 * Read one item by slug. Validates the on-disk file against the
 * collection's current schema; throws on schema mismatch so corrupt
 * data is surfaced rather than silently propagating.
 *
 * Accepts the collection def as an argument (rather than reading it
 * here) so callers can amortise the def read across many item reads.
 */
export async function readItem(
  collectionSlug: string,
  itemSlug: string,
  def: CollectionDef,
): Promise<Item | null> {
  slugSchema.parse(collectionSlug);
  itemSlugSchema.parse(itemSlug);
  const raw = await readJson<unknown>(itemPath(collectionSlug, itemSlug));
  if (raw === null) return null;
  const file = buildItemFileSchema(def.fields).parse(raw);
  return materialiseItem(itemSlug, file);
}

/** Combine the file's `{ id, values }` with the slug derived from the filename. */
function materialiseItem(slug: string, file: ItemFile): Item {
  return { id: file.id, slug, values: file.values };
}

/**
 * Write an item. Validates against the collection's schema and ensures
 * the item's own `slug` field matches the target slug (which becomes
 * the filename).
 */
export async function writeItem(
  collectionSlug: string,
  itemSlug: string,
  item: Item,
  def: CollectionDef,
): Promise<void> {
  slugSchema.parse(collectionSlug);
  itemSlugSchema.parse(itemSlug);
  if (item.slug !== itemSlug) {
    throw new Error(
      `writeItem: item.slug (${item.slug}) must match target slug (${itemSlug})`,
    );
  }
  const fileSchema = buildItemFileSchema(def.fields);
  const file = fileSchema.parse({ id: item.id, values: item.values });
  await fs.mkdir(itemsDir(collectionSlug), { recursive: true });
  await fs.writeFile(
    itemPath(collectionSlug, itemSlug),
    stringifyContent(file),
    "utf-8",
  );
}

/**
 * Create a new item, failing if an item with that slug already exists.
 * Used by API routes that don't want to silently clobber on `POST`.
 */
export async function createItem(
  collectionSlug: string,
  itemSlug: string,
  item: Item,
  def: CollectionDef,
): Promise<void> {
  slugSchema.parse(itemSlug); // singleton can't be created via this path
  const existing = await readItem(collectionSlug, itemSlug, def);
  if (existing !== null) {
    throw new ItemExistsError(collectionSlug, itemSlug);
  }
  await writeItem(collectionSlug, itemSlug, item, def);
}

export async function deleteItem(
  collectionSlug: string,
  itemSlug: string,
): Promise<void> {
  slugSchema.parse(collectionSlug);
  itemSlugSchema.parse(itemSlug);
  try {
    await fs.unlink(itemPath(collectionSlug, itemSlug));
  } catch (cause) {
    if (!isNotFound(cause)) throw cause;
  }
}

/**
 * List every item in a collection, respecting the configured ordering:
 *
 *   - `defaultSort = { mode: "manual" }` → use `_order.json`. Items
 *     present on disk but missing from the order file sort to the end
 *     alphabetically. Items in the order file but missing on disk are
 *     filtered out (handles deleted-but-not-yet-pruned-from-order).
 *
 *   - `defaultSort = { mode: "fieldSort", fieldId, direction }` → sort by
 *     the field's value. Items missing the field sort to the end.
 *
 *   - `defaultSort = null` → alphabetic by slug.
 */
export async function listItemsInOrder(
  collectionSlug: string,
  def: CollectionDef,
): Promise<Item[]> {
  const slugs = await listItemSlugs(collectionSlug);
  const items = (
    await Promise.all(slugs.map((slug) => readItem(collectionSlug, slug, def)))
  ).filter((item): item is Item => item !== null);

  if (def.defaultSort?.mode === "manual") {
    return sortByManualOrder(items, await readOrder(collectionSlug));
  }
  if (def.defaultSort?.mode === "fieldSort") {
    return sortByField(items, def.defaultSort.fieldId, def.defaultSort.direction);
  }
  return items.sort((a, b) => a.slug.localeCompare(b.slug));
}

function sortByManualOrder(items: Item[], order: string[] | null): Item[] {
  if (order === null) return items.sort((a, b) => a.slug.localeCompare(b.slug));
  const orderIndex = new Map(order.map((slug, idx) => [slug, idx] as const));
  return [...items].sort((a, b) => {
    const aIdx = orderIndex.get(a.slug);
    const bIdx = orderIndex.get(b.slug);
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    return a.slug.localeCompare(b.slug);
  });
}

function sortByField(
  items: Item[],
  fieldId: string,
  direction: "asc" | "desc",
): Item[] {
  return [...items].sort((a, b) => {
    const aValue = scalarSortKey(a.values[fieldId]);
    const bValue = scalarSortKey(b.values[fieldId]);
    if (aValue === null && bValue === null) return a.slug.localeCompare(b.slug);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    const cmp = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return direction === "asc" ? cmp : -cmp;
  });
}

/**
 * Extract a sortable scalar from a `FieldValue` for `fieldSort`. Only the
 * value types where sorting is meaningful are supported; others (image,
 * file, puckContent, etc.) return null and sort to the end.
 */
function scalarSortKey(value: import("./types").FieldValue | undefined): string | number | null {
  if (value === undefined) return null;
  switch (value.type) {
    case "text":
    case "longText":
    case "date":
    case "url":
    case "email":
    case "color":
    case "select":
      return value.value;
    case "number":
      return value.value;
    case "boolean":
      return value.value ? 1 : 0;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Ordering (`_order.json`)
// ---------------------------------------------------------------------------

export async function readOrder(collectionSlug: string): Promise<string[] | null> {
  slugSchema.parse(collectionSlug);
  const raw = await readJson<unknown>(orderPath(collectionSlug));
  if (raw === null) return null;
  return orderFileSchema.parse(raw);
}

export async function writeOrder(
  collectionSlug: string,
  order: string[],
): Promise<void> {
  slugSchema.parse(collectionSlug);
  const parsed = orderFileSchema.parse(order);
  await fs.mkdir(itemsDir(collectionSlug), { recursive: true });
  await fs.writeFile(orderPath(collectionSlug), stringifyContent(parsed), "utf-8");
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

/**
 * Read the single item of a singleton collection. Resolves to the same
 * shape as a regular `readItem`; the only difference is the storage
 * filename. Callers that hit this without the collection being
 * `isSingleton: true` are still served correctly — the function doesn't
 * enforce the flag.
 */
export async function readSingleton(
  collectionSlug: string,
  def: CollectionDef,
): Promise<Item | null> {
  return readItem(collectionSlug, SINGLETON_ITEM_SLUG, def);
}

export async function writeSingleton(
  collectionSlug: string,
  item: Item,
  def: CollectionDef,
): Promise<void> {
  await writeItem(collectionSlug, SINGLETON_ITEM_SLUG, item, def);
}

// ---------------------------------------------------------------------------
// Re-exports useful for callers that already have a CollectionDef and
// only need to traverse its fields without re-importing types.ts.
// ---------------------------------------------------------------------------

export function findField(
  def: CollectionDef,
  fieldId: string,
): FieldDef | undefined {
  return def.fields.find((f) => f.id === fieldId);
}
