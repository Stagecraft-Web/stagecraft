import { describe, expect, it } from "vitest";

import {
  FieldAccessError,
  getBoolean,
  getColor,
  getDate,
  getEmail,
  getFile,
  getImage,
  getImageOrNull,
  getLongText,
  getMultiSelect,
  getNumber,
  getNumberOrNull,
  getSelect,
  getText,
  getTextOrNull,
  getUrl,
  hasField,
} from "./accessors";
import type { Item } from "./schema";
import { asImageId } from "../image-types";

function makeItem(values: Item["values"]): Item {
  return { id: "item_test", slug: "test", values };
}

describe("typed accessors — happy path", () => {
  it("getText", () => {
    expect(getText(makeItem({ f: { type: "text", value: "Hi" } }), "f")).toBe("Hi");
  });
  it("getLongText", () => {
    expect(getLongText(makeItem({ f: { type: "longText", value: "Body" } }), "f")).toBe("Body");
  });
  it("getNumber", () => {
    expect(getNumber(makeItem({ f: { type: "number", value: 42 } }), "f")).toBe(42);
  });
  it("getBoolean", () => {
    expect(getBoolean(makeItem({ f: { type: "boolean", value: true } }), "f")).toBe(true);
  });
  it("getSelect", () => {
    expect(getSelect(makeItem({ f: { type: "select", value: "a" } }), "f")).toBe("a");
  });
  it("getMultiSelect", () => {
    expect(getMultiSelect(makeItem({ f: { type: "multiSelect", value: ["a", "b"] } }), "f")).toEqual(
      ["a", "b"],
    );
  });
  it("getDate", () => {
    expect(getDate(makeItem({ f: { type: "date", value: "2026-07-15" } }), "f")).toBe("2026-07-15");
  });
  it("getUrl", () => {
    expect(getUrl(makeItem({ f: { type: "url", value: "https://x.com" } }), "f")).toBe(
      "https://x.com",
    );
  });
  it("getEmail", () => {
    expect(getEmail(makeItem({ f: { type: "email", value: "a@b.com" } }), "f")).toBe("a@b.com");
  });
  it("getColor", () => {
    expect(getColor(makeItem({ f: { type: "color", value: "#ff8800" } }), "f")).toBe("#ff8800");
  });
  it("getImage", () => {
    const img = {
      id: asImageId("abc1234567890def"),
      alt: "x",
      width: 100,
      height: 100,
      placeholderDataUri: "data:image/webp;base64,xxx",
      contentSlug: "test",
      originalExt: "jpg" as const,
    };
    expect(getImage(makeItem({ f: { type: "image", value: img } }), "f")).toEqual(img);
  });
  it("getFile", () => {
    const file = { src: "/x.pdf", mimeType: "application/pdf", originalName: "x.pdf", sizeBytes: 1 };
    expect(getFile(makeItem({ f: { type: "file", value: file } }), "f")).toEqual(file);
  });
});

describe("typed accessors — missing field", () => {
  it("throws FieldAccessError with reason=missing", () => {
    try {
      getText(makeItem({}), "f");
      throw new Error("should have thrown");
    } catch (cause) {
      expect(cause).toBeInstanceOf(FieldAccessError);
      const err = cause as FieldAccessError;
      expect(err.reason).toBe("missing");
      expect(err.expectedType).toBe("text");
    }
  });

  it("OrNull variants return null instead of throwing", () => {
    expect(getTextOrNull(makeItem({}), "f")).toBeNull();
    expect(getNumberOrNull(makeItem({}), "f")).toBeNull();
    expect(getImageOrNull(makeItem({}), "f")).toBeNull();
  });
});

describe("typed accessors — wrong type", () => {
  it("throws FieldAccessError with reason=wrong-type", () => {
    try {
      getText(makeItem({ f: { type: "number", value: 1 } }), "f");
      throw new Error("should have thrown");
    } catch (cause) {
      expect(cause).toBeInstanceOf(FieldAccessError);
      const err = cause as FieldAccessError;
      expect(err.reason).toBe("wrong-type");
      expect(err.expectedType).toBe("text");
      expect(err.actualType).toBe("number");
    }
  });

  it("OrNull variants still throw on wrong-type (programmer error)", () => {
    expect(() => getTextOrNull(makeItem({ f: { type: "number", value: 1 } }), "f")).toThrow(
      FieldAccessError,
    );
  });
});

describe("hasField", () => {
  it("reports presence regardless of type", () => {
    expect(hasField(makeItem({ f: { type: "text", value: "x" } }), "f")).toBe(true);
    expect(hasField(makeItem({}), "f")).toBe(false);
  });
});
