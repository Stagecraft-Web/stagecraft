import { describe, expect, it } from "vitest";

import type { FieldDef } from "./types";
import {
  buildItemFileSchema,
  buildValuesSchema,
  collectionDefSchema,
  fieldDefSchema,
  isFieldRequired,
  itemSlugSchema,
  orderFileSchema,
  RESERVED_ITEM_SLUGS,
  slugSchema,
} from "./zod";

describe("slugSchema", () => {
  it("accepts kebab-case slugs", () => {
    expect(slugSchema.parse("tour-dates")).toBe("tour-dates");
    expect(slugSchema.parse("home")).toBe("home");
    expect(slugSchema.parse("page-2")).toBe("page-2");
  });

  it.each(["_singleton", "_order", "Tour-Dates", "tour dates", "-tour", "", "/"])(
    "rejects %s",
    (bad) => {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    },
  );

  it("flags _singleton and _order as reserved", () => {
    expect(RESERVED_ITEM_SLUGS).toContain("_singleton");
    expect(RESERVED_ITEM_SLUGS).toContain("_order");
  });
});

describe("itemSlugSchema", () => {
  it("accepts regular slugs and the singleton sentinel", () => {
    expect(itemSlugSchema.parse("paris-2026")).toBe("paris-2026");
    expect(itemSlugSchema.parse("_singleton")).toBe("_singleton");
  });

  it("rejects _order (only valid as a filename, not an item slug)", () => {
    expect(itemSlugSchema.safeParse("_order").success).toBe(false);
  });
});

describe("fieldDefSchema", () => {
  it("parses every field type in the v1 palette", () => {
    const cases: FieldDef[] = [
      { id: "f1", key: "title", type: "text", required: true, maxLength: 100 },
      { id: "f2", key: "body", type: "longText", required: false },
      { id: "f3", key: "bio", type: "richText", required: false },
      { id: "f4", key: "price", type: "number", required: true, min: 0 },
      { id: "f5", key: "isPublic", type: "boolean", default: true },
      {
        id: "f6",
        key: "status",
        type: "select",
        required: true,
        options: [
          { id: "o1", value: "on_sale", label: "On sale" },
          { id: "o2", value: "sold_out", label: "Sold out" },
        ],
      },
      {
        id: "f7",
        key: "tags",
        type: "multiSelect",
        options: [
          { id: "o3", value: "rock", label: "Rock" },
        ],
      },
      { id: "f8", key: "date", type: "date", required: true, includeTime: false },
      { id: "f9", key: "url", type: "url", required: false },
      { id: "f10", key: "email", type: "email", required: false },
      { id: "f11", key: "accent", type: "color", required: false },
      { id: "f12", key: "cover", type: "image", required: true },
      {
        id: "f13",
        key: "attachment",
        type: "file",
        required: false,
        mimeFilter: ["audio/*", "application/pdf"],
      },
      {
        id: "f14",
        key: "relatedRelease",
        type: "collectionRef",
        required: false,
        targetCollection: "releases",
      },
      { id: "f15", key: "body", type: "puckContent" },
    ];
    for (const def of cases) {
      expect(fieldDefSchema.parse(def)).toEqual(def);
    }
  });

  it("rejects unknown field types", () => {
    expect(
      fieldDefSchema.safeParse({ id: "f", key: "x", type: "made-up", required: true }).success,
    ).toBe(false);
  });

  it("rejects select with zero options", () => {
    expect(
      fieldDefSchema.safeParse({
        id: "f",
        key: "x",
        type: "select",
        required: true,
        options: [],
      }).success,
    ).toBe(false);
  });
});

describe("collectionDefSchema", () => {
  const baseDef = {
    slug: "tour-dates",
    singularName: "tour date",
    pluralName: "tour dates",
    fields: [
      { id: "f_date", key: "date", type: "date", required: true },
      { id: "f_venue", key: "venue", type: "text", required: true },
    ],
    slugSourceFieldId: "f_venue",
    detailUrlPrefix: "/shows",
    defaultSort: { mode: "fieldSort", fieldId: "f_date", direction: "asc" },
    itemTemplate: null,
    detailTemplate: null,
    listTemplate: null,
    isSingleton: false,
  } as const;

  it("parses a valid def", () => {
    expect(collectionDefSchema.parse(baseDef).slug).toBe("tour-dates");
  });

  it("rejects duplicate field ids", () => {
    const def = {
      ...baseDef,
      fields: [
        { id: "dup", key: "a", type: "text", required: true },
        { id: "dup", key: "b", type: "text", required: true },
      ],
      slugSourceFieldId: null,
      defaultSort: null,
    };
    expect(collectionDefSchema.safeParse(def).success).toBe(false);
  });

  it("rejects duplicate field keys", () => {
    const def = {
      ...baseDef,
      fields: [
        { id: "a", key: "samekey", type: "text", required: true },
        { id: "b", key: "samekey", type: "text", required: true },
      ],
      slugSourceFieldId: null,
      defaultSort: null,
    };
    expect(collectionDefSchema.safeParse(def).success).toBe(false);
  });

  it("rejects slugSourceFieldId that doesn't exist on the schema", () => {
    expect(
      collectionDefSchema.safeParse({ ...baseDef, slugSourceFieldId: "nope" }).success,
    ).toBe(false);
  });

  it("rejects defaultSort referencing an unknown field", () => {
    expect(
      collectionDefSchema.safeParse({
        ...baseDef,
        defaultSort: { mode: "fieldSort", fieldId: "nope", direction: "asc" },
      }).success,
    ).toBe(false);
  });

  it("rejects detailUrlPrefix not starting with /", () => {
    expect(
      collectionDefSchema.safeParse({ ...baseDef, detailUrlPrefix: "shows" }).success,
    ).toBe(false);
  });

  it("accepts detailUrlPrefix = null (no detail pages)", () => {
    const def = { ...baseDef, detailUrlPrefix: null };
    expect(collectionDefSchema.parse(def).detailUrlPrefix).toBe(null);
  });

  it("accepts a manual-sort def", () => {
    const def = {
      ...baseDef,
      defaultSort: { mode: "manual" as const },
    };
    expect(collectionDefSchema.parse(def).defaultSort).toEqual({ mode: "manual" });
  });

  it("accepts itemTemplate as a minimal Puck Data shape", () => {
    const def = { ...baseDef, itemTemplate: { content: [], root: { props: {} } } };
    expect(collectionDefSchema.parse(def).itemTemplate).toEqual({
      content: [],
      root: { props: {} },
    });
  });
});

describe("buildValuesSchema", () => {
  const fields: FieldDef[] = [
    { id: "f_title", key: "title", type: "text", required: true, maxLength: 50 },
    { id: "f_subtitle", key: "subtitle", type: "text", required: false },
    { id: "f_count", key: "count", type: "number", required: true, min: 0, max: 100 },
  ];

  it("accepts a valid item with all required fields present", () => {
    const schema = buildValuesSchema(fields);
    expect(
      schema.parse({
        f_title: { type: "text", value: "Hello" },
        f_count: { type: "number", value: 5 },
      }),
    ).toEqual({
      f_title: { type: "text", value: "Hello" },
      f_count: { type: "number", value: 5 },
    });
  });

  it("accepts an optional field being absent", () => {
    const schema = buildValuesSchema(fields);
    expect(
      schema.parse({
        f_title: { type: "text", value: "Hello" },
        f_count: { type: "number", value: 5 },
      }),
    ).not.toHaveProperty("f_subtitle");
  });

  it("rejects when a required field is missing", () => {
    const schema = buildValuesSchema(fields);
    expect(
      schema.safeParse({ f_count: { type: "number", value: 5 } }).success,
    ).toBe(false);
  });

  it("enforces field-level constraints (maxLength, min/max)", () => {
    const schema = buildValuesSchema(fields);
    expect(
      schema.safeParse({
        f_title: { type: "text", value: "x".repeat(60) },
        f_count: { type: "number", value: 5 },
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        f_title: { type: "text", value: "ok" },
        f_count: { type: "number", value: 1000 },
      }).success,
    ).toBe(false);
  });

  it("rejects type mismatches", () => {
    const schema = buildValuesSchema(fields);
    expect(
      schema.safeParse({
        f_title: { type: "number", value: 1 },
        f_count: { type: "number", value: 5 },
      }).success,
    ).toBe(false);
  });

  it("strips unknown field ids (a deleted field still in the file)", () => {
    const schema = buildValuesSchema(fields);
    const parsed = schema.parse({
      f_title: { type: "text", value: "Hello" },
      f_count: { type: "number", value: 5 },
      f_deleted: { type: "text", value: "stale" },
    });
    expect(parsed).not.toHaveProperty("f_deleted");
  });
});

describe("buildValuesSchema — type-specific rules", () => {
  it("date without time accepts YYYY-MM-DD only", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "date", type: "date", required: true, includeTime: false },
    ]);
    expect(schema.parse({ f: { type: "date", value: "2026-07-15" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "date", value: "2026-07-15T12:00" } }).success).toBe(
      false,
    );
  });

  it("date with time accepts ISO 8601 datetime", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "date", type: "date", required: true, includeTime: true },
    ]);
    expect(schema.parse({ f: { type: "date", value: "2026-07-15T20:00:00Z" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "date", value: "2026-07-15" } }).success).toBe(false);
  });

  it("url validates as URL", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "u", type: "url", required: true },
    ]);
    expect(schema.parse({ f: { type: "url", value: "https://example.com" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "url", value: "not a url" } }).success).toBe(false);
  });

  it("email validates as email", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "e", type: "email", required: true },
    ]);
    expect(schema.parse({ f: { type: "email", value: "x@y.com" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "email", value: "not-email" } }).success).toBe(false);
  });

  it("color validates as 6-digit hex", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "c", type: "color", required: true },
    ]);
    expect(schema.parse({ f: { type: "color", value: "#ff8800" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "color", value: "ff8800" } }).success).toBe(false);
    expect(schema.safeParse({ f: { type: "color", value: "#fff" } }).success).toBe(false);
  });

  it("select restricts to declared option values", () => {
    const schema = buildValuesSchema([
      {
        id: "f",
        key: "s",
        type: "select",
        required: true,
        options: [
          { id: "o1", value: "a", label: "A" },
          { id: "o2", value: "b", label: "B" },
        ],
      },
    ]);
    expect(schema.parse({ f: { type: "select", value: "a" } })).toBeDefined();
    expect(schema.safeParse({ f: { type: "select", value: "c" } }).success).toBe(false);
  });

  it("multiSelect restricts every value to declared options", () => {
    const schema = buildValuesSchema([
      {
        id: "f",
        key: "m",
        type: "multiSelect",
        options: [
          { id: "o1", value: "x", label: "X" },
          { id: "o2", value: "y", label: "Y" },
        ],
      },
    ]);
    expect(schema.parse({ f: { type: "multiSelect", value: ["x", "y"] } })).toBeDefined();
    expect(
      schema.safeParse({ f: { type: "multiSelect", value: ["x", "z"] } }).success,
    ).toBe(false);
  });

  it("file applies mime filter when provided", () => {
    const schema = buildValuesSchema([
      { id: "f", key: "a", type: "file", required: true, mimeFilter: ["audio/*"] },
    ]);
    expect(
      schema.parse({
        f: {
          type: "file",
          value: { src: "/files/x.mp3", mimeType: "audio/mpeg", originalName: "x.mp3", sizeBytes: 1 },
        },
      }),
    ).toBeDefined();
    expect(
      schema.safeParse({
        f: {
          type: "file",
          value: {
            src: "/files/x.pdf",
            mimeType: "application/pdf",
            originalName: "x.pdf",
            sizeBytes: 1,
          },
        },
      }).success,
    ).toBe(false);
  });
});

describe("isFieldRequired", () => {
  it("treats boolean and multiSelect as optional regardless of caller intent", () => {
    expect(
      isFieldRequired({ id: "f", key: "b", type: "boolean" }),
    ).toBe(false);
    expect(
      isFieldRequired({ id: "f", key: "m", type: "multiSelect", options: [] }),
    ).toBe(false);
  });

  it("treats puckContent as optional (artist may leave a body empty)", () => {
    expect(isFieldRequired({ id: "f", key: "body", type: "puckContent" })).toBe(false);
  });

  it("respects the required flag for other types", () => {
    expect(
      isFieldRequired({ id: "f", key: "t", type: "text", required: true }),
    ).toBe(true);
    expect(
      isFieldRequired({ id: "f", key: "t", type: "text", required: false }),
    ).toBe(false);
  });
});

describe("buildItemFileSchema", () => {
  it("validates the full on-disk shape", () => {
    const schema = buildItemFileSchema([
      { id: "f_t", key: "title", type: "text", required: true },
    ]);
    expect(
      schema.parse({
        id: "item_123",
        values: { f_t: { type: "text", value: "Hello" } },
      }),
    ).toBeDefined();
  });

  it("rejects an item without an id", () => {
    const schema = buildItemFileSchema([]);
    expect(schema.safeParse({ values: {} }).success).toBe(false);
  });
});

describe("orderFileSchema", () => {
  it("accepts an array of slugs", () => {
    expect(orderFileSchema.parse(["a", "b", "c-2"])).toEqual(["a", "b", "c-2"]);
  });

  it("rejects entries that aren't valid slugs", () => {
    expect(orderFileSchema.safeParse(["valid", "NOT-VALID"]).success).toBe(false);
  });

  it("accepts an empty array", () => {
    expect(orderFileSchema.parse([])).toEqual([]);
  });
});
