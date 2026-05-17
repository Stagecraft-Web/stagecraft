import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { commitFilesMock } = vi.hoisted(() => ({ commitFilesMock: vi.fn() }));
vi.mock("./git-commit", () => ({ commitFiles: commitFilesMock }));

import { PublishError, publish, publishPage, isPlatformConfigured } from "./publish";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
} from "./site-config-types";
import { tourDatesDef } from "./collections/test-fixtures";

const TEST_SLUG = "publish-test";

// Each worker writes to its own tmpdir (resolved via STAGECRAFT_CONTENT_DIR)
// so parallel test files can't clobber each other's site.json / page files
// — see the matching pattern in content.test.ts.
let TMP_CONTENT_DIR: string;
let TEST_FILE: string;

const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  TMP_CONTENT_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "stagecraft-publish-"));
  TEST_FILE = path.join(TMP_CONTENT_DIR, "pages", `${TEST_SLUG}.json`);
});

afterAll(async () => {
  await fs.rm(TMP_CONTENT_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  commitFilesMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.STAGECRAFT_PLATFORM_URL;
  delete process.env.STAGECRAFT_SITE_ID;
  delete process.env.STAGECRAFT_BROKER_SECRET;
  process.env.STAGECRAFT_CONTENT_DIR = TMP_CONTENT_DIR;
});

afterEach(async () => {
  await fs.rm(TEST_FILE, { force: true });
});

function configurePlatform({
  ok = true,
  body = {
    ok: true,
    token: "ghs_token",
    expiresAt: "2099-01-01T00:00:00.000Z",
    repo: { owner: "artist", name: "site" },
  },
  status = 200,
}: { ok?: boolean; body?: unknown; status?: number } = {}) {
  process.env.STAGECRAFT_PLATFORM_URL = "https://platform.example.com";
  process.env.STAGECRAFT_SITE_ID = "site-123";
  process.env.STAGECRAFT_BROKER_SECRET = "broker-secret";
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "ERR",
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("isPlatformConfigured", () => {
  it("false when no env vars", () => {
    expect(isPlatformConfigured()).toBe(false);
  });

  it("true when all three are set", () => {
    process.env.STAGECRAFT_PLATFORM_URL = "x";
    process.env.STAGECRAFT_SITE_ID = "y";
    process.env.STAGECRAFT_BROKER_SECRET = "z";
    expect(isPlatformConfigured()).toBe(true);
  });

  it("false when any one is missing", () => {
    process.env.STAGECRAFT_PLATFORM_URL = "x";
    process.env.STAGECRAFT_SITE_ID = "y";
    expect(isPlatformConfigured()).toBe(false);
  });
});

describe("publishPage — dev fallback (no platform configured)", () => {
  it("writes JSON to local disk and returns mode=local", async () => {
    const result = await publishPage({
      pageSlug: TEST_SLUG,
      data: { content: [], root: {} },
      authorEmail: "a@e.com",
    });
    expect(result.mode).toBe("local");
    expect(result.commitSha).toBeNull();
    const written = await fs.readFile(TEST_FILE, "utf-8");
    expect(JSON.parse(written)).toEqual({ content: [], root: {} });
  });

  it("does not call commitFiles in dev fallback", async () => {
    await publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" });
    expect(commitFilesMock).not.toHaveBeenCalled();
  });
});

describe("publishPage — broker + GitHub path", () => {
  it("commits via GitHub when platform is configured", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("commit-sha-abc");

    const result = await publishPage({
      pageSlug: TEST_SLUG,
      data: { hello: "world" },
      authorEmail: "artist@example.com",
      authorName: "Real Artist",
    });

    expect(result).toEqual({ mode: "github", commitSha: "commit-sha-abc" });
    expect(commitFilesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "ghs_token",
        owner: "artist",
        repo: "site",
        branch: "main",
        files: [
          expect.objectContaining({ path: `src/content/pages/${TEST_SLUG}.json` }),
        ],
        author: { name: "Real Artist", email: "artist@example.com" },
      }),
    );
  });

  it("forwards Authorization Bearer secret to the broker", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("https://platform.example.com/api/publish-token");
    expect(fetchCall[1].headers.authorization).toBe("Bearer broker-secret");
    expect(JSON.parse(fetchCall[1].body)).toEqual({ siteId: "site-123" });
  });

  it("trims trailing slash on platform url", async () => {
    configurePlatform();
    process.env.STAGECRAFT_PLATFORM_URL = "https://platform.example.com/";
    commitFilesMock.mockResolvedValue("sha");
    await publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("https://platform.example.com/api/publish-token");
  });

  it("throws PublishError with broker-unreachable when fetch throws", async () => {
    configurePlatform();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    await expect(
      publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" }),
    ).rejects.toMatchObject({ code: "broker-unreachable" });
  });

  it("throws broker-rejected when broker returns non-200", async () => {
    configurePlatform({ ok: false, status: 401, body: { ok: false } });
    await expect(
      publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" }),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("throws broker-rejected when broker response is malformed", async () => {
    configurePlatform({ body: { ok: true, token: "x" } }); // missing repo + expiresAt
    await expect(
      publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" }),
    ).rejects.toMatchObject({ code: "broker-rejected" });
  });

  it("wraps GitHub failures as github-failed", async () => {
    configurePlatform();
    commitFilesMock.mockRejectedValue(new Error("ref not found"));
    await expect(
      publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" }),
    ).rejects.toMatchObject({ code: "github-failed" });
  });

  it("includes a Stagecraft-Publish-Id trailer in the commit message", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" });
    const message = commitFilesMock.mock.calls[0][0].message as string;
    expect(message).toMatch(/^Update publish-test/);
    expect(message).toMatch(/Stagecraft-Publish-Id: [0-9a-f-]{36}$/);
  });

  it("respects SITE_GIT_BRANCH env override", async () => {
    configurePlatform();
    process.env.SITE_GIT_BRANCH = "develop";
    commitFilesMock.mockResolvedValue("sha");
    await publishPage({ pageSlug: TEST_SLUG, data: {}, authorEmail: "a@e.com" });
    expect(commitFilesMock.mock.calls[0][0].branch).toBe("develop");
  });
});

describe("publish — multi-target API", () => {
  it("rejects empty target list", async () => {
    await expect(
      publish({ targets: [], authorEmail: "a@e.com" }),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("dev fallback writes site-config to disk", async () => {
    // Writes into the worker-scoped tmpdir (see STAGECRAFT_CONTENT_DIR in
    // beforeEach) so parallel test files can't clobber the on-disk state.
    const sitePath = path.join(TMP_CONTENT_DIR, "config/site.json");
    const cfg = { ...DEFAULT_SITE_CONFIG, artistName: "Multi-target Test" };
    const out = await publish({
      targets: [{ kind: "site-config", data: cfg }],
      authorEmail: "a@e.com",
    });
    expect(out.mode).toBe("local");
    const written = JSON.parse(await fs.readFile(sitePath, "utf-8"));
    expect(written.artistName).toBe("Multi-target Test");
    await fs.rm(sitePath, { force: true });
  });

  it("commits multiple targets in a single GitHub commit when configured", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("multi-sha");
    const result = await publish({
      targets: [
        { kind: "page", slug: TEST_SLUG, data: { content: [], root: {} } },
        { kind: "site-config", data: DEFAULT_SITE_CONFIG },
        { kind: "header-config", data: DEFAULT_HEADER_CONFIG },
        { kind: "appearance", data: DEFAULT_APPEARANCE },
      ],
      authorEmail: "a@e.com",
    });
    expect(result.commitSha).toBe("multi-sha");
    expect(commitFilesMock).toHaveBeenCalledTimes(1);
    const call = commitFilesMock.mock.calls[0][0];
    expect(call.files.map((f: { path: string }) => f.path)).toEqual([
      `src/content/pages/${TEST_SLUG}.json`,
      "src/content/config/site.json",
      "src/content/config/header.json",
      "src/content/config/appearance.json",
    ]);
  });

  it("delete-page produces a deletePath rather than a file write", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("del-sha");
    await publish({
      targets: [{ kind: "delete-page", slug: TEST_SLUG }],
      authorEmail: "a@e.com",
    });
    const call = commitFilesMock.mock.calls[0][0];
    expect(call.files).toHaveLength(0);
    expect(call.deletePaths).toEqual([`src/content/pages/${TEST_SLUG}.json`]);
  });

  it("validates site-config before commit (fails on bad email)", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await expect(
      publish({
        targets: [
          {
            kind: "site-config",
            data: { ...DEFAULT_SITE_CONFIG, contactEmail: "not-an-email" } as never,
          },
        ],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("commit subject summarises targets", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await publish({
      targets: [
        { kind: "page", slug: "home", data: {} },
        { kind: "site-config", data: DEFAULT_SITE_CONFIG },
      ],
      authorEmail: "a@e.com",
    });
    const message = commitFilesMock.mock.calls[0][0].message as string;
    expect(message).toMatch(/^Update pages: home \+ site settings/);
  });

  it("custom commitSubject overrides the auto summary", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await publish({
      targets: [{ kind: "page", slug: TEST_SLUG, data: {} }],
      authorEmail: "a@e.com",
      commitSubject: "Custom subject line",
    });
    const message = commitFilesMock.mock.calls[0][0].message as string;
    expect(message).toMatch(/^Custom subject line/);
  });
});

// ---------------------------------------------------------------------------
// Collection target kinds (ADR-009)
// ---------------------------------------------------------------------------

describe("publish — collection target kinds", () => {
  it("collection-def writes to <slug>/_collection.json in github mode", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("commit-sha");
    await publish({
      targets: [
        { kind: "collection-def", collectionSlug: "tour-dates", data: tourDatesDef() },
      ],
      authorEmail: "a@e.com",
    });
    const files = commitFilesMock.mock.calls[0][0].files as { path: string }[];
    expect(files[0].path).toBe("src/content/collections/tour-dates/_collection.json");
  });

  it("collection-def rejects an invalid def at the publish layer", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    const bad = tourDatesDef();
    bad.fields = [
      { id: "dup", key: "a", type: "text", required: true },
      { id: "dup", key: "b", type: "text", required: true },
    ];
    bad.slugSourceFieldId = null;
    bad.defaultSort = null;
    await expect(
      publish({
        targets: [{ kind: "collection-def", collectionSlug: "tour-dates", data: bad }],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("collection-def rejects a slug mismatch", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await expect(
      publish({
        targets: [
          {
            kind: "collection-def",
            collectionSlug: "tour-dates",
            data: { ...tourDatesDef(), slug: "different" },
          },
        ],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("collection-item writes to items/<itemSlug>.json", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("commit-sha");
    await publish({
      targets: [
        {
          kind: "collection-item",
          collectionSlug: "tour-dates",
          itemSlug: "paris-2026",
          data: { id: "item_p", values: {} },
        },
      ],
      authorEmail: "a@e.com",
    });
    const files = commitFilesMock.mock.calls[0][0].files as { path: string }[];
    expect(files[0].path).toBe(
      "src/content/collections/tour-dates/items/paris-2026.json",
    );
  });

  it("collection-item rejects a payload missing the id (structural guard)", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await expect(
      publish({
        targets: [
          {
            kind: "collection-item",
            collectionSlug: "tour-dates",
            itemSlug: "paris-2026",
            data: { values: {} },
          },
        ],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("collection-item rejects a CollectionDef pasted in by mistake", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await expect(
      publish({
        targets: [
          {
            kind: "collection-item",
            collectionSlug: "tour-dates",
            itemSlug: "paris-2026",
            data: tourDatesDef(),
          },
        ],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("delete-collection-item adds to deletePaths instead of writes", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("commit-sha");
    await publish({
      targets: [
        {
          kind: "delete-collection-item",
          collectionSlug: "tour-dates",
          itemSlug: "paris-2026",
        },
      ],
      authorEmail: "a@e.com",
    });
    const args = commitFilesMock.mock.calls[0][0] as { files: unknown[]; deletePaths: string[] };
    expect(args.files).toEqual([]);
    expect(args.deletePaths).toEqual([
      "src/content/collections/tour-dates/items/paris-2026.json",
    ]);
  });

  it("collection-order writes the order list to items/_order.json", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("commit-sha");
    await publish({
      targets: [
        {
          kind: "collection-order",
          collectionSlug: "tour-dates",
          data: ["paris-2026", "berlin-2026"],
        },
      ],
      authorEmail: "a@e.com",
    });
    const files = commitFilesMock.mock.calls[0][0].files as { path: string; content: string }[];
    expect(files[0].path).toBe("src/content/collections/tour-dates/items/_order.json");
    expect(JSON.parse(files[0].content)).toEqual(["paris-2026", "berlin-2026"]);
  });

  it("collection-order rejects invalid slugs in the list", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await expect(
      publish({
        targets: [
          {
            kind: "collection-order",
            collectionSlug: "tour-dates",
            data: ["valid", "NOT-VALID"],
          },
        ],
        authorEmail: "a@e.com",
      }),
    ).rejects.toThrow();
    expect(commitFilesMock).not.toHaveBeenCalled();
  });

  it("dev fallback writes collection-def, items, and order to disk", async () => {
    // No platform configuration → local writes.
    await publish({
      targets: [
        { kind: "collection-def", collectionSlug: "tour-dates", data: tourDatesDef() },
        {
          kind: "collection-item",
          collectionSlug: "tour-dates",
          itemSlug: "paris-2026",
          data: { id: "item_p", values: { f_date: { type: "date", value: "2026-07-15" } } },
        },
        {
          kind: "collection-order",
          collectionSlug: "tour-dates",
          data: ["paris-2026"],
        },
      ],
      authorEmail: "a@e.com",
    });
    expect(commitFilesMock).not.toHaveBeenCalled();
    const defOnDisk = JSON.parse(
      await fs.readFile(
        path.join(TMP_CONTENT_DIR, "collections/tour-dates/_collection.json"),
        "utf-8",
      ),
    );
    expect(defOnDisk.slug).toBe("tour-dates");
    const itemOnDisk = JSON.parse(
      await fs.readFile(
        path.join(TMP_CONTENT_DIR, "collections/tour-dates/items/paris-2026.json"),
        "utf-8",
      ),
    );
    expect(itemOnDisk.id).toBe("item_p");
    const orderOnDisk = JSON.parse(
      await fs.readFile(
        path.join(TMP_CONTENT_DIR, "collections/tour-dates/items/_order.json"),
        "utf-8",
      ),
    );
    expect(orderOnDisk).toEqual(["paris-2026"]);
  });

  it("summariseTargets covers each collection target kind", async () => {
    configurePlatform();
    commitFilesMock.mockResolvedValue("sha");
    await publish({
      targets: [
        { kind: "collection-def", collectionSlug: "tour-dates", data: tourDatesDef() },
        {
          kind: "collection-item",
          collectionSlug: "tour-dates",
          itemSlug: "paris-2026",
          data: { id: "i", values: {} },
        },
        {
          kind: "collection-order",
          collectionSlug: "tour-dates",
          data: ["paris-2026"],
        },
        {
          kind: "delete-collection-item",
          collectionSlug: "tour-dates",
          itemSlug: "old-show",
        },
      ],
      authorEmail: "a@e.com",
    });
    const message = commitFilesMock.mock.calls[0][0].message as string;
    expect(message).toContain("collection defs: tour-dates");
    expect(message).toContain("items: tour-dates/paris-2026");
    expect(message).toContain("order: tour-dates");
    expect(message).toContain("delete items: tour-dates/old-show");
  });
});
