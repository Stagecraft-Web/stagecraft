import { describe, expect, it } from "vitest";
import { components } from "../index";
import type { SchemaAttribute } from "@markdoc/markdoc";

// ---------------------------------------------------------------------------
// Cross-schema consistency test.
//
// Each content-component declares two schemas side-by-side in its schema.ts:
//
//   - `markdoc`   — validated at build time by @astrojs/markdoc
//   - `keystatic` — validated in the admin UI by @keystatic/core
//
// There's no built-in bridge between the two and no IDE feedback for .mdoc
// files, so the two declarations can silently drift. This test walks the
// component registry and asserts:
//
//   1. KEY PARITY          — every attribute name exists in both
//      (wrappers' implicit `children` slot is exempt)
//   2. TYPE COMPATIBILITY  — the keystatic field type maps to markdoc's
//      declared `type` constructor (String/Number/Boolean)
//   3. DEFAULTS MATCH      — when both declare a default, the values agree;
//      when only one does, we emit a console.warn (not a failure — there
//      are legitimate one-sided cases like keystatic's `fields.select` which
//      requires a defaultValue while markdoc may not)
//
// If a component legitimately has an attribute that only exists on one side,
// its schema.ts should `export const exemptKeys: string[]` listing those
// attribute names. The test consumes that export when present.
// ---------------------------------------------------------------------------

type KeystaticField = {
  kind: string;
  formKind?: string;
  defaultValue?: (() => unknown) | unknown;
  options?: readonly { label: string; value: string }[];
  label?: string;
};

type ComponentEntry = {
  tagName: string;
  markdoc: {
    attributes?: Record<string, SchemaAttribute>;
  };
  keystatic: {
    kind: string; // "wrapper" | "block" | ...
    schema: Record<string, KeystaticField>;
  };
  exemptKeys?: string[];
};

/**
 * Safely read a keystatic field's runtime default. `defaultValue` is a
 * zero-arg function on `BasicFormField`/`SlugFormField`; for `AssetFormField`
 * (image) it also exists but returns an object, which we don't compare.
 */
function readKeystaticDefault(field: KeystaticField): unknown {
  if (typeof field.defaultValue !== "function") return undefined;
  try {
    return (field.defaultValue as () => unknown)();
  } catch {
    return undefined;
  }
}

/**
 * Map a keystatic field to the markdoc attribute-type constructor it should
 * align with. Returns `undefined` if the field type is unrecognized — the
 * caller treats that as "skip type check for this attribute" rather than
 * failing, to avoid blocking on new keystatic field types.
 *
 * Mapping rules:
 *   - formKind "slug"  (text, slug, url)                      → String
 *   - formKind "asset" (image, file)                          → String
 *   - has `options` array (select)                            → String
 *   - defaultValue() returns boolean                          → Boolean
 *   - defaultValue() returns number                           → Number
 */
function keystaticFieldToMarkdocType(
  field: KeystaticField,
): StringConstructor | NumberConstructor | BooleanConstructor | undefined {
  if (field.formKind === "slug" || field.formKind === "asset") return String;
  if (Array.isArray(field.options)) return String;

  const defaultVal = readKeystaticDefault(field);
  if (typeof defaultVal === "boolean") return Boolean;
  if (typeof defaultVal === "number") return Number;
  if (typeof defaultVal === "string") return String;

  return undefined;
}

function typeName(
  ctor: StringConstructor | NumberConstructor | BooleanConstructor | unknown,
): string {
  if (ctor === String) return "String";
  if (ctor === Number) return "Number";
  if (ctor === Boolean) return "Boolean";
  return String(ctor);
}

describe("content-component schema consistency", () => {
  const entries = components as readonly ComponentEntry[];

  it("loads every component with markdoc and keystatic exports", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.tagName, `component is missing tagName`).toBeTruthy();
      expect(entry.markdoc, `${entry.tagName}: missing markdoc export`).toBeDefined();
      expect(entry.keystatic, `${entry.tagName}: missing keystatic export`).toBeDefined();
      expect(
        entry.keystatic.schema,
        `${entry.tagName}: keystatic schema is not exposed (check wrapper/block return)`,
      ).toBeDefined();
    }
  });

  for (const entry of entries) {
    describe(entry.tagName, () => {
      const markdocAttrs = entry.markdoc.attributes ?? {};
      const keystaticFields = entry.keystatic.schema;
      const markdocKeys = new Set(Object.keys(markdocAttrs));
      const keystaticKeys = new Set(Object.keys(keystaticFields));
      const exemptKeys = new Set(entry.exemptKeys ?? []);

      it("every markdoc attribute has a keystatic field", () => {
        const missing = [...markdocKeys].filter(
          (k) => !keystaticKeys.has(k) && !exemptKeys.has(k),
        );
        expect(missing, `${entry.tagName}: markdoc keys not in keystatic: ${missing.join(", ")}`).toEqual([]);
      });

      it("every keystatic field has a markdoc attribute (except wrapper children)", () => {
        const missing = [...keystaticKeys].filter((k) => {
          if (markdocKeys.has(k)) return false;
          if (exemptKeys.has(k)) return false;
          // Wrappers have implicit children rendered by markdoc as the tag
          // body. If a keystatic wrapper happens to expose a `children` field
          // explicitly, we accept it without requiring a markdoc attr.
          if (entry.keystatic.kind === "wrapper" && k === "children") return false;
          return true;
        });
        expect(missing, `${entry.tagName}: keystatic keys not in markdoc: ${missing.join(", ")}`).toEqual([]);
      });

      it("field types align between markdoc and keystatic", () => {
        const mismatches: string[] = [];
        for (const key of keystaticKeys) {
          if (exemptKeys.has(key)) continue;
          if (!markdocKeys.has(key)) continue; // covered by key parity test
          const kField = keystaticFields[key];
          const expected = keystaticFieldToMarkdocType(kField);
          if (expected === undefined) continue; // unknown field — skip
          const actual = markdocAttrs[key]?.type;
          if (actual !== expected) {
            mismatches.push(
              `${key}: keystatic suggests ${typeName(expected)}, markdoc declares ${typeName(actual)}`,
            );
          }
        }
        expect(mismatches, `${entry.tagName}: ${mismatches.join("; ")}`).toEqual([]);
      });

      it("keystatic select options align with markdoc matches", () => {
        // When a keystatic field is a `select` (i.e. exposes an `options`
        // array), the corresponding markdoc attribute must declare the same
        // allowed values via `matches: [...]`. This locks both ends of the
        // bridge to the same enum so a value valid in the admin UI is also
        // valid at build time, and vice versa.
        const mismatches: string[] = [];
        for (const key of keystaticKeys) {
          if (exemptKeys.has(key)) continue;
          if (!markdocKeys.has(key)) continue;
          const kField = keystaticFields[key];
          if (!Array.isArray(kField.options)) continue;

          const keystaticValues = kField.options.map((o) => o.value).sort();
          const markdocAttr = markdocAttrs[key];
          const markdocMatches = markdocAttr?.matches;

          if (!Array.isArray(markdocMatches)) {
            mismatches.push(
              `${key}: keystatic is select(${keystaticValues.join("|")}) but markdoc has no \`matches\` array`,
            );
            continue;
          }

          // Markdoc's `matches` typing allows non-string entries (regex, etc.)
          // but for select-backed enums we expect string literals only.
          const markdocValues = [...markdocMatches]
            .map((v) => (typeof v === "string" ? v : String(v)))
            .sort();
          if (
            keystaticValues.length !== markdocValues.length ||
            keystaticValues.some((v, i) => v !== markdocValues[i])
          ) {
            mismatches.push(
              `${key}: keystatic options [${keystaticValues.join(", ")}] != markdoc matches [${markdocValues.join(", ")}]`,
            );
          }
        }
        expect(
          mismatches,
          `${entry.tagName}: ${mismatches.join("; ")}`,
        ).toEqual([]);
      });

      it("defaults match when both declare them", () => {
        for (const key of keystaticKeys) {
          if (exemptKeys.has(key)) continue;
          if (!markdocKeys.has(key)) continue;

          const kField = keystaticFields[key];
          // Only compare primitive defaults — image/asset defaults are
          // objects that don't have a markdoc analogue.
          if (kField.formKind === "asset") continue;

          const kDefault = readKeystaticDefault(kField);
          const mDefault = markdocAttrs[key]?.default;

          const kHas = kDefault !== undefined && kDefault !== null && kDefault !== "";
          const mHas = mDefault !== undefined;

          if (kHas && mHas) {
            expect(
              kDefault,
              `${entry.tagName}.${key}: keystatic default (${JSON.stringify(kDefault)}) != markdoc default (${JSON.stringify(mDefault)})`,
            ).toEqual(mDefault);
          } else if (kHas !== mHas) {
            // Not a failure — e.g. fields.select requires defaultValue while
            // markdoc's attribute can omit it. Surface as a warning so the
            // author can decide whether to align them.
            console.warn(
              `[schema-consistency] ${entry.tagName}.${key}: one-sided default (keystatic=${JSON.stringify(
                kDefault,
              )}, markdoc=${JSON.stringify(mDefault)})`,
            );
          }
        }
      });
    });
  }
});
