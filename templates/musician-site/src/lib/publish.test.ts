import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { commitFilesMock } = vi.hoisted(() => ({ commitFilesMock: vi.fn() }));
vi.mock("./git-commit", () => ({ commitFiles: commitFilesMock }));

import { PublishError, publish, publishPage, isPlatformConfigured } from "./publish";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_SITE_CONFIG,
} from "./site-config-types";

const TEST_SLUG = "publish-test";
const TEST_FILE = path.join(process.cwd(), "src/content/pages", `${TEST_SLUG}.json`);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  commitFilesMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.STAGECRAFT_PLATFORM_URL;
  delete process.env.STAGECRAFT_SITE_ID;
  delete process.env.STAGECRAFT_BROKER_SECRET;
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

const TEST_FILES_TO_CLEAN = [
  path.join(process.cwd(), "src/content/pages", `${TEST_SLUG}.json`),
  path.join(process.cwd(), "src/content/pages", `${TEST_SLUG}-2.json`),
];

afterEach(async () => {
  await Promise.all(TEST_FILES_TO_CLEAN.map((f) => fs.rm(f, { force: true })));
});

describe("publish — multi-target API", () => {
  it("rejects empty target list", async () => {
    await expect(
      publish({ targets: [], authorEmail: "a@e.com" }),
    ).rejects.toBeInstanceOf(PublishError);
  });

  it("dev fallback writes site-config to disk", async () => {
    // Snapshot the existing site.json (if any) so the test doesn't leave
    // the repo dirty. Restore the original on exit; if there was no
    // original, remove the file we just wrote.
    const sitePath = path.join(process.cwd(), "src/content/config/site.json");
    const original = await fs.readFile(sitePath, "utf-8").catch(() => null);
    try {
      const cfg = { ...DEFAULT_SITE_CONFIG, artistName: "Multi-target Test" };
      const out = await publish({
        targets: [{ kind: "site-config", data: cfg }],
        authorEmail: "a@e.com",
      });
      expect(out.mode).toBe("local");
      const written = JSON.parse(await fs.readFile(sitePath, "utf-8"));
      expect(written.artistName).toBe("Multi-target Test");
    } finally {
      if (original !== null) {
        await fs.writeFile(sitePath, original, "utf-8");
      } else {
        await fs.rm(sitePath, { force: true });
      }
    }
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
