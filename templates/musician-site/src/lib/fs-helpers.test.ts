import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  contentDir,
  isNotFound,
  localPathForRepoPath,
  readdirFiltered,
  readJson,
  REPO_CONTENT_PREFIX,
  stringifyContent,
  unlinkIfExists,
  writeJson,
} from "./fs-helpers";

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

describe("writeJson", () => {
  it("creates parent directories as needed", async () => {
    const file = path.join(TMP_DIR, "deep/nested/dir/file.json");
    await writeJson(file, { x: 1 });
    expect(await readJson(file)).toEqual({ x: 1 });
  });

  it("writes with canonical formatting (matches stringifyContent)", async () => {
    const file = path.join(TMP_DIR, "format.json");
    await writeJson(file, { a: 1 });
    expect(await fs.readFile(file, "utf-8")).toBe('{\n  "a": 1\n}\n');
  });
});

describe("readdirFiltered", () => {
  it("returns the picked values from each entry, sorted", async () => {
    const dir = path.join(TMP_DIR, "filt");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "c.json"), "");
    await fs.writeFile(path.join(dir, "a.json"), "");
    await fs.writeFile(path.join(dir, "b.txt"), "");
    const result = await readdirFiltered(dir, (e) =>
      e.isFile() && e.name.endsWith(".json") ? e.name.replace(/\.json$/, "") : null,
    );
    expect(result).toEqual(["a", "c"]);
  });

  it("returns [] when the directory doesn't exist (ENOENT swallowed)", async () => {
    expect(await readdirFiltered(path.join(TMP_DIR, "nope"), () => "x")).toEqual([]);
  });
});

describe("unlinkIfExists", () => {
  it("deletes the file when present", async () => {
    const file = path.join(TMP_DIR, "to-delete.txt");
    await fs.writeFile(file, "");
    await unlinkIfExists(file);
    expect(await readJson(file)).toBeNull();
  });

  it("is a no-op when the file doesn't exist", async () => {
    await expect(unlinkIfExists(path.join(TMP_DIR, "nope.txt"))).resolves.toBeUndefined();
  });
});

describe("localPathForRepoPath", () => {
  it("maps a src/content/... path under STAGECRAFT_CONTENT_DIR", () => {
    expect(localPathForRepoPath("src/content/pages/home.json")).toBe(
      path.join(TMP_DIR, "pages/home.json"),
    );
  });

  it("falls back to <cwd>/<path> for paths outside src/content/", () => {
    expect(localPathForRepoPath("public/images/x.png")).toBe(
      path.join(process.cwd(), "public/images/x.png"),
    );
  });

  it("REPO_CONTENT_PREFIX is the canonical prefix", () => {
    expect(REPO_CONTENT_PREFIX).toBe("src/content/");
  });
});
