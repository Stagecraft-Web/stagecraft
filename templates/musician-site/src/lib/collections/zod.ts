/**
 * Zod schemas for the Collection abstraction.
 *
 * Two layers:
 *
 *   1. `collectionDefSchema` — static schema for `_collection.json`. The
 *      shape doesn't depend on the artist's field configuration.
 *
 *   2. `buildItemSchema(fields)` — dynamic schema for one item, built
 *      from the collection's `FieldDef[]`. Required fields must be
 *      present; optional fields may be absent from `values`. This is
 *      the "runtime validation is strong" claim from ADR §10.
 *
 * Templates (`itemTemplate` etc.) are validated as opaque Puck `Data` —
 * structural validity of the Puck JSON is Puck's concern, not ours.
 */

import type { Data as PuckData } from "@measured/puck";
import { z, type ZodTypeAny } from "zod";

import { imageMetadataSchema } from "../image-types";

import {
  ORDER_FILE_NAME,
  SINGLETON_ITEM_SLUG,
  SLUG_PATTERN,
  type CollectionDef,
  type FieldDef,
  type FieldValue,
  type Item,
  type ItemFile,
} from "./types";

// ---------------------------------------------------------------------------
// Slug schemas
// ---------------------------------------------------------------------------

/**
 * Slug shape used for both collection slugs and regular item slugs. The
 * singleton-item slug (`_singleton`) and the order-file name (`_order`)
 * intentionally fail this pattern so they can't collide with user
 * content.
 */
export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    SLUG_PATTERN,
    "Slug must be lowercase letters, digits, and hyphens (start with a letter or digit)",
  );

/**
 * Item-slug shape. Accepts either a regular slug or the reserved
 * `_singleton` for singleton collections. The store layer chooses
 * which to use based on `CollectionDef.isSingleton`.
 */
export const itemSlugSchema = z.union([
  slugSchema,
  z.literal(SINGLETON_ITEM_SLUG),
]);

/** Reserved names that can never appear as user-authored item slugs. */
export const RESERVED_ITEM_SLUGS: readonly string[] = [
  SINGLETON_ITEM_SLUG,
  ORDER_FILE_NAME,
];

// ---------------------------------------------------------------------------
// FieldDef → Zod (for validating the collection definition itself)
// ---------------------------------------------------------------------------

const fieldIdSchema = z.string().min(1);
const fieldKeySchema = z.string().min(1).max(64);

const selectOptionSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  label: z.string().min(1),
});

/**
 * Schema validating one `FieldDef`. Mirrors the discriminated union in
 * `./types.ts`; every variant is enumerated explicitly so renaming or
 * adding a field type forces a corresponding change here.
 */
export const fieldDefSchema = z.discriminatedUnion("type", [
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("text"),
    required: z.boolean(),
    maxLength: z.number().int().positive().optional(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("longText"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("richText"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("number"),
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("boolean"),
    default: z.boolean().optional(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("select"),
    required: z.boolean(),
    options: z.array(selectOptionSchema).min(1),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("multiSelect"),
    options: z.array(selectOptionSchema).min(1),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("date"),
    required: z.boolean(),
    includeTime: z.boolean().optional(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("url"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("email"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("color"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("image"),
    required: z.boolean(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("file"),
    required: z.boolean(),
    mimeFilter: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("collectionRef"),
    required: z.boolean(),
    targetCollection: slugSchema,
  }),
  z.object({
    id: fieldIdSchema,
    key: fieldKeySchema,
    type: z.literal("puckContent"),
  }),
]);

// ---------------------------------------------------------------------------
// CollectionDef schema
// ---------------------------------------------------------------------------

const collectionSortSchema = z.union([
  z.object({ mode: z.literal("manual") }),
  z.object({
    mode: z.literal("fieldSort"),
    fieldId: fieldIdSchema,
    direction: z.enum(["asc", "desc"]),
  }),
]);

/**
 * Puck `Data` is validated leniently — we accept any object with a
 * `content` array and a `root` object. The Puck library does its own
 * deeper shape checks at render time.
 *
 * The cast to `z.ZodType<PuckData>` is a trust boundary: anything that
 * survives Puck's own runtime checks in the editor and round-trips
 * through `stringifyContent` will parse here. We intentionally don't
 * mirror Puck's full discriminated Data shape, both because it's an
 * internal API and because mirroring it would couple this layer to
 * Puck's release cadence.
 */
const puckDataLooseSchema = z
  .object({
    content: z.array(z.unknown()),
    root: z.object({}).passthrough().optional(),
  })
  .passthrough() as unknown as z.ZodType<PuckData>;

/**
 * Schema validating `_collection.json`. Cross-field invariants (sort
 * field exists in `fields`, slugSourceFieldId exists, no duplicate
 * field ids or keys) are checked via `superRefine`.
 */
export const collectionDefSchema = z
  .object({
    slug: slugSchema,
    singularName: z.string().min(1),
    pluralName: z.string().min(1),

    fields: z.array(fieldDefSchema),
    slugSourceFieldId: fieldIdSchema.nullable(),

    detailUrlPrefix: z.string().nullable(),

    defaultSort: collectionSortSchema.nullable(),

    itemTemplate: puckDataLooseSchema.nullable(),
    detailTemplate: puckDataLooseSchema.nullable(),
    listTemplate: puckDataLooseSchema.nullable(),

    isSingleton: z.boolean(),
  })
  .superRefine((def, ctx) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    for (const field of def.fields) {
      if (ids.has(field.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `Duplicate field id: ${field.id}`,
        });
      }
      ids.add(field.id);
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `Duplicate field key: ${field.key}`,
        });
      }
      keys.add(field.key);
    }
    if (def.slugSourceFieldId && !ids.has(def.slugSourceFieldId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slugSourceFieldId"],
        message: `slugSourceFieldId references unknown field: ${def.slugSourceFieldId}`,
      });
    }
    if (def.defaultSort?.mode === "fieldSort" && !ids.has(def.defaultSort.fieldId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultSort", "fieldId"],
        message: `defaultSort.fieldId references unknown field: ${def.defaultSort.fieldId}`,
      });
    }
    if (def.detailUrlPrefix !== null && !def.detailUrlPrefix.startsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["detailUrlPrefix"],
        message: "detailUrlPrefix must start with '/' or be null",
      });
    }
  }) satisfies z.ZodType<CollectionDef>;

// ---------------------------------------------------------------------------
// Dynamic item schema (per-collection)
// ---------------------------------------------------------------------------

/**
 * Schema validating one `FieldValue` against its `FieldDef`. Field-level
 * config (maxLength, min/max, select options, mime filters) is enforced
 * here so an item can't carry a value the schema editor wouldn't accept.
 */
export function buildFieldValueZodSchema(field: FieldDef): ZodTypeAny {
  switch (field.type) {
    case "text": {
      let inner = z.string();
      if (field.maxLength !== undefined) inner = inner.max(field.maxLength);
      return z.object({ type: z.literal("text"), value: inner });
    }
    case "longText":
      return z.object({ type: z.literal("longText"), value: z.string() });
    case "richText":
      // Tiptap doc shape — lenient (PR 2's renderer does deeper validation).
      return z.object({
        type: z.literal("richText"),
        value: z.object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() }),
      });
    case "number": {
      let inner = z.number();
      if (field.min !== undefined) inner = inner.min(field.min);
      if (field.max !== undefined) inner = inner.max(field.max);
      return z.object({ type: z.literal("number"), value: inner });
    }
    case "boolean":
      return z.object({ type: z.literal("boolean"), value: z.boolean() });
    case "select": {
      const allowed = field.options.map((o) => o.value);
      return z.object({
        type: z.literal("select"),
        value: z.string().refine((v) => allowed.includes(v), {
          message: `value must be one of: ${allowed.join(", ")}`,
        }),
      });
    }
    case "multiSelect": {
      const allowed = field.options.map((o) => o.value);
      return z.object({
        type: z.literal("multiSelect"),
        value: z
          .array(z.string())
          .refine((arr) => arr.every((v) => allowed.includes(v)), {
            message: `every value must be one of: ${allowed.join(", ")}`,
          }),
      });
    }
    case "date": {
      // ISO 8601 — date-only (YYYY-MM-DD) or datetime depending on includeTime.
      const pattern = field.includeTime
        ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
        : /^\d{4}-\d{2}-\d{2}$/;
      return z.object({
        type: z.literal("date"),
        value: z.string().regex(pattern, {
          message: field.includeTime
            ? "value must be ISO 8601 datetime (YYYY-MM-DDTHH:MM[:SS][Z|±HH:MM])"
            : "value must be ISO 8601 date (YYYY-MM-DD)",
        }),
      });
    }
    case "url":
      return z.object({ type: z.literal("url"), value: z.string().url() });
    case "email":
      return z.object({ type: z.literal("email"), value: z.string().email() });
    case "color":
      return z.object({
        type: z.literal("color"),
        value: z.string().regex(/^#[0-9a-fA-F]{6}$/, "value must be a 6-digit hex color"),
      });
    case "image":
      return z.object({ type: z.literal("image"), value: imageMetadataSchema });
    case "file": {
      const fileValueShape = z.object({
        src: z.string().min(1),
        mimeType: z.string().min(1),
        originalName: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
      });
      const valueSchema = field.mimeFilter
        ? fileValueShape.refine((v) => matchesMimeFilter(v.mimeType, field.mimeFilter ?? []), {
            message: `mimeType must match one of: ${field.mimeFilter.join(", ")}`,
          })
        : fileValueShape;
      return z.object({ type: z.literal("file"), value: valueSchema });
    }
    case "collectionRef":
      return z.object({
        type: z.literal("collectionRef"),
        value: z.object({
          collection: slugSchema,
          itemId: z.string().min(1),
        }),
      });
    case "puckContent":
      return z.object({ type: z.literal("puckContent"), value: puckDataLooseSchema });
  }
}

/**
 * MIME filter pattern. Supports literal types (`audio/mpeg`) and
 * wildcards (`audio/*`, `*\/*`). The wildcard form is what the artist
 * sees most often — it matches everything under that type.
 */
function matchesMimeFilter(mime: string, filters: string[]): boolean {
  return filters.some((filter) => {
    if (filter === "*/*") return true;
    if (filter.endsWith("/*")) return mime.startsWith(filter.slice(0, -1));
    return mime === filter;
  });
}

/**
 * Build a Zod schema for the `values` map of an item, given the
 * collection's fields. Required fields must be present; optional fields
 * may be absent. Extra keys (fields that no longer exist on the schema
 * but still appear in the item) are stripped on parse — this is how
 * "field removed" looks at read time.
 */
export function buildValuesSchema(
  fields: FieldDef[],
): z.ZodType<Record<string, FieldValue>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of fields) {
    const valueSchema = buildFieldValueZodSchema(field);
    shape[field.id] = isFieldRequired(field) ? valueSchema : valueSchema.optional();
  }
  // `.strip()` is z.object's default — keys not in `shape` are dropped on
  // parse, which is the behaviour we want for fields the artist deleted.
  return z.object(shape) as unknown as z.ZodType<Record<string, FieldValue>>;
}

/** Required-ness with sensible defaults for variants that omit the flag. */
export function isFieldRequired(field: FieldDef): boolean {
  switch (field.type) {
    case "boolean":
    case "multiSelect":
    case "puckContent":
      return false;
    default:
      return field.required;
  }
}

/**
 * Build a Zod schema for an entire `Item`, given the collection's
 * fields. Composes `buildValuesSchema` with the surrounding `{ id, slug,
 * values }` envelope used by the in-memory `Item` type.
 */
export function buildItemSchema(fields: FieldDef[]): z.ZodType<Item> {
  return z.object({
    id: z.string().min(1),
    slug: itemSlugSchema,
    values: buildValuesSchema(fields),
  });
}

/**
 * Build a Zod schema for the on-disk `ItemFile` (slug omitted — derived
 * from the filename). Used by the store layer when reading.
 */
export function buildItemFileSchema(fields: FieldDef[]): z.ZodType<ItemFile> {
  return z.object({
    id: z.string().min(1),
    values: buildValuesSchema(fields),
  });
}

// ---------------------------------------------------------------------------
// _order.json
// ---------------------------------------------------------------------------

/**
 * Shape of `items/_order.json` — an ordered list of item slugs. Unknown
 * slugs (e.g. a deleted item still referenced by an older commit) are
 * filtered out at read time by the store, so this schema only enforces
 * the array shape.
 */
export const orderFileSchema = z.array(slugSchema);
