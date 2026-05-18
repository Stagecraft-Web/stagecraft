/**
 * Each prebaked CollectionDef must satisfy the full
 * `collectionDefSchema` — duplicate field ids, slug-source mismatches,
 * and the like would fail at the schema-editor level later. Catch
 * them now so the seeds are valid the moment they ship.
 */

import { describe, expect, it } from "vitest";

import { collectionDefSchema } from "./schema";
import {
  appearanceCollectionDef,
  headerCollectionDef,
  pagesCollectionDef,
  PREBAKED_COLLECTIONS,
  siteCollectionDef,
} from "./seeds";

describe("prebaked CollectionDefs", () => {
  it.each([
    ["pages", pagesCollectionDef],
    ["site", siteCollectionDef],
    ["header", headerCollectionDef],
    ["appearance", appearanceCollectionDef],
  ])("%s parses against collectionDefSchema", (_slug, def) => {
    expect(() => collectionDefSchema.parse(def)).not.toThrow();
  });

  it("the registry exposes all four", () => {
    expect(Object.keys(PREBAKED_COLLECTIONS).sort()).toEqual(
      ["appearance", "header", "pages", "site"].sort(),
    );
  });

  it("pages collection marks title and body as systemLocked", () => {
    const fields = pagesCollectionDef.fields;
    const title = fields.find((f) => f.key === "title");
    const body = fields.find((f) => f.key === "body");
    expect(title?.systemLocked).toBe(true);
    expect(body?.systemLocked).toBe(true);
  });

  it("singletons set isSingleton: true and detailUrlPrefix: null", () => {
    for (const slug of ["site", "header", "appearance"] as const) {
      const def = PREBAKED_COLLECTIONS[slug];
      expect(def.isSingleton).toBe(true);
      expect(def.detailUrlPrefix).toBeNull();
    }
  });

  it("pages collection is not a singleton and uses manual sort", () => {
    expect(pagesCollectionDef.isSingleton).toBe(false);
    expect(pagesCollectionDef.detailUrlPrefix).toBe("/");
    expect(pagesCollectionDef.defaultSort).toEqual({ mode: "manual" });
  });

  it("every field has a unique id within its collection", () => {
    for (const [slug, def] of Object.entries(PREBAKED_COLLECTIONS)) {
      const ids = new Set<string>();
      for (const field of def.fields) {
        expect(ids.has(field.id), `${slug}: duplicate field id ${field.id}`).toBe(false);
        ids.add(field.id);
      }
    }
  });

  it("appearance has exactly 9 colors + 5 weight + 3 typography fields", () => {
    const fields = appearanceCollectionDef.fields;
    const colorFields = fields.filter((f) => f.key.startsWith("color_"));
    const weightFields = fields.filter(
      (f) => f.key.endsWith("_body") || f.key.endsWith("_bodyBold") || /Weight_h[1-3]$/.test(f.key),
    );
    expect(colorFields).toHaveLength(9);
    expect(weightFields).toHaveLength(5);
    expect(fields.find((f) => f.key === "bodyFont")).toBeDefined();
    expect(fields.find((f) => f.key === "headingMode")).toBeDefined();
    expect(fields.find((f) => f.key === "headingFont")).toBeDefined();
  });
});
