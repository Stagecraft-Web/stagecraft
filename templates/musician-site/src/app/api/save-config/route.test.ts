import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: getSessionMock }));

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn() }));
vi.mock("@/lib/publish", async () => {
  const actual = await vi.importActual<typeof import("@/lib/publish")>("@/lib/publish");
  return { ...actual, publish: publishMock };
});

import { POST } from "./route";
import {
  APPEARANCE_FIELD_IDS,
  HEADER_FIELD_IDS,
  SITE_FIELD_IDS,
} from "@/lib/collections/seeds";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
} from "@/lib/site-config-types";

// Worker-scoped tmpdir keeps these tests isolated from other test files that
// also touch the collection store (publish.test.ts, content.test.ts).
let TMP_CONTENT_DIR: string;
let SITE_ITEM_PATH: string;
let HEADER_ITEM_PATH: string;
let APPEARANCE_ITEM_PATH: string;

beforeAll(async () => {
  TMP_CONTENT_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "stagecraft-saveconfig-"));
  SITE_ITEM_PATH = path.join(TMP_CONTENT_DIR, "collections/site/items/_singleton.json");
  HEADER_ITEM_PATH = path.join(TMP_CONTENT_DIR, "collections/header/items/_singleton.json");
  APPEARANCE_ITEM_PATH = path.join(
    TMP_CONTENT_DIR,
    "collections/appearance/items/_singleton.json",
  );
});

afterAll(async () => {
  await fs.rm(TMP_CONTENT_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  getSessionMock.mockReset();
  publishMock.mockReset();
  publishMock.mockResolvedValue({ commitSha: null, mode: "local" });
  process.env.STAGECRAFT_CONTENT_DIR = TMP_CONTENT_DIR;
});

afterEach(async () => {
  // Wipe the collections tree between tests so each one starts clean
  // (including the prebaked `_collection.json`s the wrapper bootstraps
  // on first read).
  await fs.rm(path.join(TMP_CONTENT_DIR, "collections"), { recursive: true, force: true });
});

function postJson(body: unknown) {
  return new Request("https://x/api/save-config", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/save-config", () => {
  it("returns 401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await POST(
      postJson({ kind: "site-config", data: DEFAULT_SITE_CONFIG }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON body", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const res = await POST(
      new Request("https://x/api/save-config", { method: "POST", body: "nope" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown kind", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const res = await POST(postJson({ kind: "unknown", data: {} }));
    expect(res.status).toBe(400);
  });

  it("persists site-config and triggers publish", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    publishMock.mockResolvedValue({ commitSha: "site-sha", mode: "github" });

    const data = { ...DEFAULT_SITE_CONFIG, artistName: "Pumpkin Bread" };
    const res = await POST(postJson({ kind: "site-config", data }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // On disk: the site singleton item carries the artistName under
    // its corresponding field id.
    const onDisk = JSON.parse(await fs.readFile(SITE_ITEM_PATH, "utf-8"));
    expect(onDisk.values[SITE_FIELD_IDS.artistName].value).toBe("Pumpkin Bread");

    // Publish was called with a collection-item target for the site
    // singleton (plus a pages order target — the call fans out per
    // ADR-009 §14).
    const call = publishMock.mock.calls[0][0];
    const siteTarget = call.targets.find(
      (t: { kind: string; collectionSlug?: string }) =>
        t.kind === "collection-item" && t.collectionSlug === "site",
    );
    expect(siteTarget).toBeDefined();
    expect(siteTarget.data.values[SITE_FIELD_IDS.artistName].value).toBe("Pumpkin Bread");
  });

  it("persists header-config", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = { ...DEFAULT_HEADER_CONFIG, headerSubtitle: "Bandleader" };
    const res = await POST(postJson({ kind: "header-config", data }));
    expect(res.status).toBe(200);
    const onDisk = JSON.parse(await fs.readFile(HEADER_ITEM_PATH, "utf-8"));
    expect(onDisk.values[HEADER_FIELD_IDS.headerSubtitle].value).toBe("Bandleader");
  });

  it("persists appearance", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = {
      ...DEFAULT_APPEARANCE,
      colors: { ...DEFAULT_APPEARANCE.colors, primary: "#ff0066" },
    };
    const res = await POST(postJson({ kind: "appearance", data }));
    expect(res.status).toBe(200);
    const onDisk = JSON.parse(await fs.readFile(APPEARANCE_ITEM_PATH, "utf-8"));
    expect(onDisk.values[APPEARANCE_FIELD_IDS.color("primary")].value).toBe("#ff0066");
  });

  it("returns publishWarning when local write succeeds but publish fails", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const { PublishError } = await vi.importActual<typeof import("@/lib/publish")>(
      "@/lib/publish",
    );
    publishMock.mockRejectedValue(new PublishError("broker-unreachable", "down"));

    const data = { ...DEFAULT_SITE_CONFIG, artistName: "Fallback" };
    const res = await POST(postJson({ kind: "site-config", data }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.publishWarning).toContain("down");
    // Disk write happened — the artistName landed in the singleton item.
    expect(
      JSON.parse(await fs.readFile(SITE_ITEM_PATH, "utf-8")).values[SITE_FIELD_IDS.artistName]
        .value,
    ).toBe("Fallback");
  });

  it("rejects an invalid contact email payload", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = { ...DEFAULT_SITE_CONFIG, contactEmail: "not-an-email" };
    const res = await POST(postJson({ kind: "site-config", data }));
    expect(res.status).toBe(400);
  });
});
