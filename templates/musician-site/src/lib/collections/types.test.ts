/**
 * Compile-time exhaustiveness checks for the discriminated unions in
 * types.ts. The tests "pass" by typechecking — any future addition of a
 * field type that doesn't update the switch will fail `npm run
 * typecheck` here before the runtime test even runs.
 */
import { describe, expect, it } from "vitest";

import type { FieldDef, FieldValue } from "./types";
import { ORDER_FILE_NAME, SINGLETON_ITEM_SLUG, SLUG_PATTERN } from "./types";

function assertNever(value: never): never {
  throw new Error(`non-exhaustive switch: ${JSON.stringify(value)}`);
}

/** Forces a compile error if any FieldDef.type is unhandled. */
function describeFieldDef(def: FieldDef): string {
  switch (def.type) {
    case "text":
    case "longText":
    case "richText":
    case "number":
    case "boolean":
    case "select":
    case "multiSelect":
    case "date":
    case "url":
    case "email":
    case "color":
    case "image":
    case "file":
    case "collectionRef":
    case "puckContent":
      return def.type;
    default:
      return assertNever(def);
  }
}

/** Forces a compile error if any FieldValue.type is unhandled. */
function describeFieldValue(v: FieldValue): string {
  switch (v.type) {
    case "text":
    case "longText":
    case "richText":
    case "number":
    case "boolean":
    case "select":
    case "multiSelect":
    case "date":
    case "url":
    case "email":
    case "color":
    case "image":
    case "file":
    case "collectionRef":
    case "puckContent":
      return v.type;
    default:
      return assertNever(v);
  }
}

describe("type model", () => {
  it("FieldDef and FieldValue switch exhaustively", () => {
    // The compile-time guarantees are the real test; we exercise the
    // runtime to confirm the switch path actually runs.
    expect(describeFieldDef({ id: "f", key: "t", type: "text", required: true })).toBe("text");
    expect(describeFieldValue({ type: "text", value: "Hi" })).toBe("text");
  });

  it("exports reserved filenames as constants (not magic strings)", () => {
    expect(SINGLETON_ITEM_SLUG).toBe("_singleton");
    expect(ORDER_FILE_NAME).toBe("_order");
  });

  it("SLUG_PATTERN matches kebab-case identifiers but not reserved names", () => {
    expect(SLUG_PATTERN.test("paris-2026")).toBe(true);
    expect(SLUG_PATTERN.test("_singleton")).toBe(false);
    expect(SLUG_PATTERN.test("_order")).toBe(false);
    expect(SLUG_PATTERN.test("Bad-Slug")).toBe(false);
  });
});
