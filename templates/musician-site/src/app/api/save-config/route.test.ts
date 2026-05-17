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
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
} from "@/lib/site-config-types";

// Worker-scoped tmpdir keeps these tests isolated from other test files that
// also touch src/content/config/*.json (publish.test.ts, content.test.ts).
let TMP_CONTENT_DIR: string;
let SITE_PATH: string;
let HEADER_PATH: string;
let APPEARANCE_PATH: string;

beforeAll(async () => {
  TMP_CONTENT_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "stagecraft-saveconfig-"));
  SITE_PATH = path.join(TMP_CONTENT_DIR, "config/site.json");
  HEADER_PATH = path.join(TMP_CONTENT_DIR, "config/header.json");
  APPEARANCE_PATH = path.join(TMP_CONTENT_DIR, "config/appearance.json");
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
  // Clear any singleton a test wrote.
  await fs.rm(SITE_PATH, { force: true });
  await fs.rm(HEADER_PATH, { force: true });
  await fs.rm(APPEARANCE_PATH, { force: true });
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

    const onDisk = JSON.parse(await fs.readFile(SITE_PATH, "utf-8"));
    expect(onDisk.artistName).toBe("Pumpkin Bread");

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({ kind: "site-config", data: expect.objectContaining({ artistName: "Pumpkin Bread" }) }),
        ],
      }),
    );
  });

  it("persists header-config", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = { ...DEFAULT_HEADER_CONFIG, items: ["home", "about"] };
    const res = await POST(postJson({ kind: "header-config", data }));
    expect(res.status).toBe(200);
    const onDisk = JSON.parse(await fs.readFile(HEADER_PATH, "utf-8"));
    expect(onDisk.items).toEqual(["home", "about"]);
  });

  it("persists appearance", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = {
      ...DEFAULT_APPEARANCE,
      colors: { ...DEFAULT_APPEARANCE.colors, primary: "#ff0066" },
    };
    const res = await POST(postJson({ kind: "appearance", data }));
    expect(res.status).toBe(200);
    const onDisk = JSON.parse(await fs.readFile(APPEARANCE_PATH, "utf-8"));
    expect(onDisk.colors.primary).toBe("#ff0066");
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
    // Disk write happened.
    expect(JSON.parse(await fs.readFile(SITE_PATH, "utf-8")).artistName).toBe("Fallback");
  });

  it("rejects an invalid contact email payload", async () => {
    getSessionMock.mockResolvedValue({ email: "a@b.c" });
    const data = { ...DEFAULT_SITE_CONFIG, contactEmail: "not-an-email" };
    const res = await POST(postJson({ kind: "site-config", data }));
    expect(res.status).toBe(400);
  });
});
