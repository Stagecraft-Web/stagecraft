/**
 * Core type model for the unified Collection abstraction (ADR-009).
 *
 * Every editable surface on a musician site — pages, singletons, tour
 * dates, releases, posts, store items, photos, videos — is a `Collection`
 * with a schema (`FieldDef[]`), items (`Item[]`), and Puck-edited
 * templates. The types here are the source of truth for that model; the
 * Zod schemas in `./zod.ts` derive from them.
 *
 * Conventions:
 *
 *   - `FieldId` is a stable internal id that survives renames; `FieldKey`
 *     is the artist-facing name. Item values reference fields by id.
 *
 *   - `FieldDef` and `FieldValue` are exhaustive discriminated unions over
 *     the v1 field-type palette (ADR §6). Renderers and editors get
 *     compile-time exhaustiveness by switching on `.type`.
 *
 *   - `Item.values` is `Record<FieldId, FieldValue>` — type-safe at the
 *     value-kind level but not at the which-fields-are-present level,
 *     because the schema is editable at runtime by the artist (ADR §10).
 *     Runtime narrowing via `./accessors.ts` is the consumer pattern.
 *
 *   - `Bindable<T>` and the field-render primitives are referenced from
 *     these types but are template-renderer concerns; the renderer lands
 *     in PR 2.
 */

import type { Data as PuckData } from "@measured/puck";

import type { ImageMetadata } from "../image-types";

// ---------------------------------------------------------------------------
// Identifiers and slug shape
// ---------------------------------------------------------------------------

/**
 * Stable internal id for a field. UUID-ish; never visible to the artist.
 * Item values reference fields by id, so renaming a field's `key` is a
 * zero-migration change.
 */
export type FieldId = string;

/**
 * Artist-facing name of a field (e.g. "venue"). Renameable.
 */
export type FieldKey = string;

/**
 * Stable internal id for an item, persisted inside the item file. The
 * item's URL slug is the filename and may change; the id never does.
 */
export type ItemId = string;

/**
 * Slug pattern shared by collection slugs and item slugs. Matches the
 * existing `PAGE_SLUG_PATTERN` so URLs and filenames stay consistent
 * across the template.
 *
 * Singleton items live at the reserved slug `_singleton`, which
 * intentionally fails this pattern (leading underscore) so a regular
 * item can never collide with it.
 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Reserved filename (sans `.json`) for the single item of a singleton collection. */
export const SINGLETON_ITEM_SLUG = "_singleton";

/** Reserved filename (sans `.json`) for the manual-order list inside `items/`. */
export const ORDER_FILE_NAME = "_order";

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

/** One option in a `select` / `multiSelect` field. */
export type SelectOption = {
  /** Stable internal id; survives label renames. */
  id: string;
  /** Value persisted on items (e.g. "on_sale"). */
  value: string;
  /** Artist-facing label (e.g. "On sale"). */
  label: string;
};

/**
 * Discriminated union over every field type in the v1 palette (ADR §6).
 * Adding a field type:
 *
 *   1. Add a variant here.
 *   2. Add a matching `FieldValue` variant below.
 *   3. Extend `buildFieldValueZodSchema` in `./zod.ts`.
 *   4. Add a runtime-narrowing accessor in `./accessors.ts` if the
 *      consumer code reads it directly.
 */
export type FieldDef =
  | {
      id: FieldId;
      key: FieldKey;
      type: "text";
      required: boolean;
      maxLength?: number;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "longText";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "richText";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "number";
      required: boolean;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "boolean";
      /** Default applied when an item omits the field entirely. */
      default?: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "select";
      required: boolean;
      options: SelectOption[];
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "multiSelect";
      options: SelectOption[];
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "date";
      required: boolean;
      /** When true, value carries a time component (full ISO 8601). */
      includeTime?: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "url";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "email";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "color";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "image";
      required: boolean;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "file";
      required: boolean;
      /** Allowed MIME types (e.g. `["audio/*", "application/pdf"]`). */
      mimeFilter?: string[];
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "collectionRef";
      required: boolean;
      /** Slug of the target collection (e.g. "tour-dates"). */
      targetCollection: string;
    }
  | {
      id: FieldId;
      key: FieldKey;
      type: "puckContent";
    };

/** Discriminator union of the value types a `FieldDef` can take. */
export type FieldType = FieldDef["type"];

// ---------------------------------------------------------------------------
// Field values (what `Item.values` holds for each field)
// ---------------------------------------------------------------------------

/**
 * Tiptap JSON shape. Validated leniently here — the rich-text editor (PR 6)
 * owns the strict shape. The store layer (PR 1) treats it as opaque
 * structured content.
 */
export type TiptapJSON = { type: "doc"; content?: unknown[] };

/** Concrete file reference produced by a `file`-typed field. */
export type FileRef = {
  /** Absolute or repo-root-relative path. */
  src: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
};

/**
 * Reference from one item to another item in a (potentially different)
 * collection. Resolved at render time by the consumer.
 */
export type CollectionRefValue = {
  collection: string;
  itemId: ItemId;
};

export type FieldValue =
  | { type: "text"; value: string }
  | { type: "longText"; value: string }
  | { type: "richText"; value: TiptapJSON }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "select"; value: string }
  | { type: "multiSelect"; value: string[] }
  | { type: "date"; value: string }
  | { type: "url"; value: string }
  | { type: "email"; value: string }
  | { type: "color"; value: string }
  | { type: "image"; value: ImageMetadata }
  | { type: "file"; value: FileRef }
  | { type: "collectionRef"; value: CollectionRefValue }
  | { type: "puckContent"; value: PuckData };

// ---------------------------------------------------------------------------
// Collection definition
// ---------------------------------------------------------------------------

/**
 * Ordering strategy for a collection. `manual` keeps an explicit order
 * list at `items/_order.json` (see `./store.ts`); `fieldSort` sorts by a
 * scalar field at read time; `null` (= `defaultSort` absent) falls back
 * to filesystem order (alphabetic by slug).
 */
export type CollectionSort =
  | { mode: "manual" }
  | { mode: "fieldSort"; fieldId: FieldId; direction: "asc" | "desc" };

export type CollectionDef = {
  // Identity
  slug: string;
  singularName: string;
  pluralName: string;

  // Schema
  fields: FieldDef[];
  /** Field whose value derives an item's URL slug (e.g. title → kebab-case). */
  slugSourceFieldId: FieldId | null;

  // Routing (ADR §8)
  /**
   * URL prefix at which item detail pages live (`"/"` for pages,
   * `"/shows"` for tour dates, etc.). `null` means items have no public
   * detail pages; the collection can still be embedded in Collection
   * blocks via its items, but each item has no individual URL.
   */
  detailUrlPrefix: string | null;

  // Ordering (ADR §7 + §1)
  defaultSort: CollectionSort | null;

  // Templates (all optional — null is meaningful per ADR §4)
  /** Compact list-context rendering. Primitive blocks only (no Collection blocks). */
  itemTemplate: PuckData | null;
  /** Detail-page rendering. Primitive blocks + Collection blocks. */
  detailTemplate: PuckData | null;
  /**
   * Optional auto-generated list page (e.g. `/shows`). When null, the
   * artist authors the list page as a regular Page that contains the
   * relevant Collection block.
   */
  listTemplate: PuckData | null;

  // Flags
  /**
   * True for collections that have exactly one item (settings, header,
   * appearance). UI hides item-list affordances; storage uses
   * `items/_singleton.json` instead of `items/<slug>.json`.
   */
  isSingleton: boolean;
};

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

/**
 * One entry in a collection.
 *
 * On disk, items are stored at `items/<slug>.json` containing only
 * `{ id, values }` — the slug is derived from the filename to avoid
 * drift on rename.
 */
export type Item = {
  id: ItemId;
  /** URL slug; matches the filename (without `.json`) it was loaded from. */
  slug: string;
  values: Record<FieldId, FieldValue>;
};

/** On-disk shape of an item file (slug is implicit from the filename). */
export type ItemFile = {
  id: ItemId;
  values: Record<FieldId, FieldValue>;
};

// ---------------------------------------------------------------------------
// Bindable (template-renderer types, used by PR 2; declared here so the
// type model is in one place)
// ---------------------------------------------------------------------------

/**
 * Value held by a content-bearing prop on a Primitive block in a template.
 * Either a literal of type `T`, or a binding to a `FieldId` whose value
 * is resolved against the item at render time.
 *
 * Only meaningful inside templates (itemTemplate / detailTemplate /
 * listTemplate). When the artist edits a specific item's `puckContent`
 * value, every prop is a literal — there's no "field" to bind to,
 * because the artist is producing this item's data, not a template.
 */
export type Bindable<T> =
  | { kind: "literal"; value: T }
  | { kind: "binding"; fieldId: FieldId };
