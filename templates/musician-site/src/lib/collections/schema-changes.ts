/**
 * Pure validation of schema changes (ADR-009 PR 5 / §11).
 *
 * Given an old `CollectionDef`, a proposed new one, and the current
 * set of items, decide whether the change is safe to apply. The
 * schema editor UI uses this to gate destructive operations; the API
 * route uses it as the final word before persisting.
 *
 * Decisions reflect §11:
 *
 *   - Stable field IDs. Renaming a field changes `key`, never `id`.
 *     Items reference fields by id, so renames are zero-migration.
 *   - `systemLocked` fields can't be deleted, renamed, retyped, or
 *     have their `required` flag toggled.
 *   - Add field: free. Existing items get `undefined` for the new
 *     field; required-field validation kicks in only for new items
 *     until the artist backfills.
 *   - Remove field: warn "N items have data" — caller's job to ask
 *     for confirmation. `validateSchemaChange` reports the count
 *     but doesn't block the change.
 *   - Change required (optional → required): only if every existing
 *     item already has a value for that field. Blocked otherwise.
 *   - Change type: only lossless transitions allowed. Lossy ones
 *     are blocked; the artist must remove + recreate.
 *   - Reorder: free.
 */

import type { CollectionDef, FieldDef, FieldType, Item } from "./schema";

// ---------------------------------------------------------------------------
// Allowed type transitions (ADR §11)
// ---------------------------------------------------------------------------

/**
 * The lossless type transitions. Format: `<from>` → `<to>[]`. Adding
 * a transition here doesn't automatically make it "safe" — it means
 * the structural shape can be coerced; per-instance validity still
 * runs through the per-collection Zod schema.
 *
 * Notable transitions:
 *   - text ↔ longText (string ↔ string)
 *   - text → url / email / color: only if every existing value
 *     parses; the caller runs the parse check.
 *   - select → multiSelect: wrap each scalar in a 1-element array
 *   - multiSelect → select: only if every item has ≤ 1 option set
 *
 * Everything not listed is blocked.
 */
export const LOSSLESS_TYPE_TRANSITIONS: Readonly<Record<FieldType, ReadonlyArray<FieldType>>> = {
  text: ["longText", "url", "email", "color"],
  longText: ["text"],
  richText: [],
  number: [],
  boolean: [],
  select: ["multiSelect"],
  multiSelect: ["select"],
  date: [],
  url: ["text"],
  email: ["text"],
  color: ["text"],
  image: [],
  file: [],
  collectionRef: [],
  multiCollectionRef: [],
  puckContent: [],
};

export function canTransition(from: FieldType, to: FieldType): boolean {
  if (from === to) return true;
  return LOSSLESS_TYPE_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Counting affected items
// ---------------------------------------------------------------------------

/** How many items have any value present for this field id. */
export function countItemsUsingField(items: ReadonlyArray<Item>, fieldId: string): number {
  let n = 0;
  for (const item of items) {
    if (item.values[fieldId] !== undefined) n += 1;
  }
  return n;
}

/**
 * Same shape as `countItemsUsingField`, but reports which specific
 * items have a value. Useful for the "Fix N items first" link the
 * schema editor renders when a required-flag change is blocked.
 */
export function itemsUsingField(items: ReadonlyArray<Item>, fieldId: string): Item[] {
  return items.filter((item) => item.values[fieldId] !== undefined);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type SchemaChangeIssue =
  | { kind: "system-locked-deleted"; fieldId: string; fieldKey: string }
  | { kind: "system-locked-renamed"; fieldId: string; oldKey: string; newKey: string }
  | { kind: "system-locked-retyped"; fieldId: string; fieldKey: string }
  | { kind: "system-locked-required-changed"; fieldId: string; fieldKey: string }
  | { kind: "type-transition-blocked"; fieldId: string; fieldKey: string; from: FieldType; to: FieldType }
  | {
      kind: "required-flag-blocked";
      fieldId: string;
      fieldKey: string;
      missingItemCount: number;
    }
  | { kind: "duplicate-field-id"; fieldId: string }
  | { kind: "duplicate-field-key"; fieldKey: string };

export type SchemaChangeWarning =
  | { kind: "field-removed-with-data"; fieldId: string; fieldKey: string; affectedItemCount: number };

export type SchemaChangeReport = {
  ok: boolean;
  /** Blocking issues. Non-empty means the change can't be applied. */
  issues: SchemaChangeIssue[];
  /** Non-blocking warnings — the UI surfaces them and asks for confirm. */
  warnings: SchemaChangeWarning[];
};

/**
 * Compare two CollectionDefs and the current items, return what's
 * blocking and what's worth warning about.
 *
 * `items` should reflect the on-disk state right before the change.
 * The caller (the API route) reads items via `listItemsInOrder`
 * before calling here.
 */
export function validateSchemaChange(
  oldDef: CollectionDef,
  newDef: CollectionDef,
  items: ReadonlyArray<Item>,
): SchemaChangeReport {
  const issues: SchemaChangeIssue[] = [];
  const warnings: SchemaChangeWarning[] = [];

  const oldFieldsById = new Map(oldDef.fields.map((f) => [f.id, f]));
  const newFieldsById = new Map(newDef.fields.map((f) => [f.id, f]));

  // Duplicate-id / duplicate-key checks. The Zod schema catches these
  // too, but reporting them here lets the UI show field-level errors
  // without losing context.
  checkDuplicates(newDef.fields, issues);

  // For every field in the OLD def, decide what happened to it.
  for (const oldField of oldDef.fields) {
    const newField = newFieldsById.get(oldField.id);
    if (!newField) {
      // Removed.
      if (oldField.systemLocked) {
        issues.push({
          kind: "system-locked-deleted",
          fieldId: oldField.id,
          fieldKey: oldField.key,
        });
      }
      const count = countItemsUsingField(items, oldField.id);
      if (count > 0) {
        warnings.push({
          kind: "field-removed-with-data",
          fieldId: oldField.id,
          fieldKey: oldField.key,
          affectedItemCount: count,
        });
      }
      continue;
    }

    // Field still exists; compare attributes.
    if (oldField.systemLocked) {
      if (oldField.key !== newField.key) {
        issues.push({
          kind: "system-locked-renamed",
          fieldId: oldField.id,
          oldKey: oldField.key,
          newKey: newField.key,
        });
      }
      if (oldField.type !== newField.type) {
        issues.push({
          kind: "system-locked-retyped",
          fieldId: oldField.id,
          fieldKey: oldField.key,
        });
      }
      if (
        "required" in oldField &&
        "required" in newField &&
        oldField.required !== newField.required
      ) {
        issues.push({
          kind: "system-locked-required-changed",
          fieldId: oldField.id,
          fieldKey: oldField.key,
        });
      }
    }

    if (oldField.type !== newField.type && !canTransition(oldField.type, newField.type)) {
      issues.push({
        kind: "type-transition-blocked",
        fieldId: oldField.id,
        fieldKey: newField.key,
        from: oldField.type,
        to: newField.type,
      });
    }

    // Required-flag change: optional → required is only OK if every
    // existing item has a value. The other direction (required →
    // optional) is always safe.
    if (
      "required" in oldField &&
      "required" in newField &&
      !oldField.required &&
      newField.required
    ) {
      const missing = items.length - countItemsUsingField(items, oldField.id);
      if (missing > 0) {
        issues.push({
          kind: "required-flag-blocked",
          fieldId: oldField.id,
          fieldKey: newField.key,
          missingItemCount: missing,
        });
      }
    }
  }

  // Brand-new fields (in the new def but not the old) — no checks
  // needed, "add field" is always safe.
  for (const [id] of newFieldsById) {
    if (!oldFieldsById.has(id)) {
      // Future hook: warn if a brand-new field is required AND the
      // collection has items. Today we accept it — required-field
      // validation kicks in only on the next write of each item.
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}

function checkDuplicates(fields: ReadonlyArray<FieldDef>, issues: SchemaChangeIssue[]): void {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  for (const field of fields) {
    if (seenIds.has(field.id)) {
      issues.push({ kind: "duplicate-field-id", fieldId: field.id });
    }
    seenIds.add(field.id);
    if (seenKeys.has(field.key)) {
      issues.push({ kind: "duplicate-field-key", fieldKey: field.key });
    }
    seenKeys.add(field.key);
  }
}

// ---------------------------------------------------------------------------
// Human-readable issue/warning messages — used by both the UI and the
// API route (the API route surfaces these in error responses so the
// editor can show them inline).
// ---------------------------------------------------------------------------

export function describeIssue(issue: SchemaChangeIssue): string {
  switch (issue.kind) {
    case "system-locked-deleted":
      return `Cannot delete "${issue.fieldKey}" — it's a system-locked field the renderer or routing depends on.`;
    case "system-locked-renamed":
      return `Cannot rename "${issue.oldKey}" — it's a system-locked field.`;
    case "system-locked-retyped":
      return `Cannot change the type of "${issue.fieldKey}" — it's a system-locked field.`;
    case "system-locked-required-changed":
      return `Cannot toggle the required flag on "${issue.fieldKey}" — it's a system-locked field.`;
    case "type-transition-blocked":
      return `Cannot change "${issue.fieldKey}" from ${issue.from} to ${issue.to} — the conversion is lossy. Remove the field and recreate it as the new type if you really want to.`;
    case "required-flag-blocked":
      return `Cannot mark "${issue.fieldKey}" as required: ${issue.missingItemCount} item${issue.missingItemCount === 1 ? "" : "s"} ${issue.missingItemCount === 1 ? "doesn't" : "don't"} have a value yet. Fill them in first.`;
    case "duplicate-field-id":
      return `Two fields share id "${issue.fieldId}". Field ids must be unique within a collection.`;
    case "duplicate-field-key":
      return `Two fields share name "${issue.fieldKey}". Field names must be unique within a collection.`;
  }
}

export function describeWarning(warning: SchemaChangeWarning): string {
  switch (warning.kind) {
    case "field-removed-with-data":
      return `"${warning.fieldKey}" has values on ${warning.affectedItemCount} item${warning.affectedItemCount === 1 ? "" : "s"}. Removing it deletes those values.`;
  }
}
