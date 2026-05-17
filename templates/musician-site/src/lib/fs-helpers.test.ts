import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { contentDir, isNotFound, readJson, stringifyContent } from "./fs-helpers";

let TMP_DIR: string;

beforeAll(async () => {
  TMP_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "stagecraft-fs-helpers-"));
});

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.STAGECRAFT_CONTENT_DIR = TMP_DIR;
});

describe("contentDir", () => {
  it("returns STAGECRAFT_CONTENT_DIR when set", () => {
    expect(contentDir()).toBe(TMP_DIR);
  });

  it("falls back to <cwd>/src/content when unset", () => {
    delete process.env.STAGECRAFT_CONTENT_DIR;
    expect(contentDir()).toBe(path.join(process.cwd(), "src/content"));
  });
});

describe("stringifyContent", () => {
  it("indents 2 spaces and ends with a newline", () => {
    expect(stringifyContent({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("isNotFound", () => {
  it("returns true for ENOENT errors", () => {
    expect(isNotFound({ code: "ENOENT" })).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isNotFound({ code: "EACCES" })).toBe(false);
    expect(isNotFound(new Error("oops"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });
});

describe("readJson", () => {
  it("returns null when the file doesn't exist", async () => {
    expect(await readJson(path.join(TMP_DIR, "missing.json"))).toBeNull();
  });

  it("returns null for a zero-byte file (treats half-written as missing)", async () => {
    const file = path.join(TMP_DIR, "empty.json");
    await fs.writeFile(file, "");
    expect(await readJson(file)).toBeNull();
  });

  it("parses JSON when the file is valid", async () => {
    const file = path.join(TMP_DIR, "ok.json");
    await fs.writeFile(file, '{"x":1}');
    expect(await readJson<{ x: number }>(file)).toEqual({ x: 1 });
  });

  it("throws on malformed JSON (callers want a loud failure, not a silent fallback)", async () => {
    const file = path.join(TMP_DIR, "bad.json");
    await fs.writeFile(file, "{not json");
    await expect(readJson(file)).rejects.toThrow();
  });
});
