import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    integrationAccount: { findUnique: vi.fn() },
  },
}));

vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));

import { findGithubAppInstallation } from "../github";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  prismaMock.integrationAccount.findUnique.mockReset();
  prismaMock.integrationAccount.findUnique.mockResolvedValue({
    accessToken: "ghp_test_token",
  });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("findGithubAppInstallation", () => {
  it("returns the matching installation id when app_slug + account.login both match", async () => {
    mockFetch((url) => {
      expect(url).toContain("/user/installations");
      return {
        status: 200,
        body: {
          installations: [
            { id: 111, app_slug: "netlify", account: { login: "jclaw" } },
            { id: 222, app_slug: "netlify", account: { login: "Stagecraft-Web" } },
            { id: 333, app_slug: "vercel", account: { login: "jclaw" } },
          ],
        },
      };
    });

    const id = await findGithubAppInstallation("user-1", "netlify", "jclaw");
    expect(id).toBe(111);
  });

  it("returns the org-scoped installation when ownerLogin is the org", async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        installations: [
          { id: 111, app_slug: "netlify", account: { login: "jclaw" } },
          { id: 222, app_slug: "netlify", account: { login: "Stagecraft-Web" } },
        ],
      },
    }));

    const id = await findGithubAppInstallation("user-1", "netlify", "Stagecraft-Web");
    expect(id).toBe(222);
  });

  it("returns null when no installation matches the requested owner", async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        installations: [
          { id: 111, app_slug: "netlify", account: { login: "someone-else" } },
        ],
      },
    }));

    const id = await findGithubAppInstallation("user-1", "netlify", "jclaw");
    expect(id).toBeNull();
  });

  it("returns null when no installation has the requested app_slug", async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        installations: [
          { id: 111, app_slug: "vercel", account: { login: "jclaw" } },
        ],
      },
    }));

    const id = await findGithubAppInstallation("user-1", "netlify", "jclaw");
    expect(id).toBeNull();
  });

  it("returns null on an empty installations array", async () => {
    mockFetch(() => ({ status: 200, body: { installations: [] } }));
    const id = await findGithubAppInstallation("user-1", "netlify", "jclaw");
    expect(id).toBeNull();
  });

  it("propagates GitHub API errors (e.g. 401) so the caller can surface them", async () => {
    mockFetch(() => ({ status: 401, body: { message: "Bad credentials" } }));
    await expect(
      findGithubAppInstallation("user-1", "netlify", "jclaw"),
    ).rejects.toThrow(/GitHub API error \(401\)/);
  });

  it("throws GitHub-not-connected when the user has no github IntegrationAccount", async () => {
    prismaMock.integrationAccount.findUnique.mockResolvedValueOnce(null);
    await expect(
      findGithubAppInstallation("user-1", "netlify", "jclaw"),
    ).rejects.toThrow(/GitHub account not connected/);
  });
});
