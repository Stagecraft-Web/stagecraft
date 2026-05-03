import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, listReposMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { site: { findUnique: vi.fn(), update: vi.fn() } },
  listReposMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/github-app-install", () => ({ listInstallationRepos: listReposMock }));

import { GET } from "../route";
import { signInstallState } from "@/lib/state-signing";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  authMock.mockReset();
  prismaMock.site.findUnique.mockReset();
  prismaMock.site.update.mockReset();
  listReposMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
  process.env.STAGECRAFT_STATE_SIGNING_SECRET = "test-state-secret";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function buildRequest(qs: Record<string, string> = {}): Request {
  const url = new URL("https://platform.test/api/github/install-callback");
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

function makeSite(overrides = {}) {
  return {
    id: "site-1",
    userId: "user-1",
    name: "My Site",
    brokerSecretHash: null,
    githubInstallationId: null,
    githubRepoOwner: null,
    githubRepoName: null,
    ...overrides,
  };
}

describe("GET /api/github/install-callback", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Sign in required");
  });

  it("400 when params are missing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const res = await GET(buildRequest());
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing parameters");
  });

  it("400 when state is invalid", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const res = await GET(buildRequest({ installation_id: "1", state: "bogus" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("expired or invalid");
  });

  it("403 when state's userId doesn't match the session", async () => {
    authMock.mockResolvedValue({ user: { id: "user-2" } });
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("User mismatch");
  });

  it("404 when site doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(null);
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(404);
  });

  it("404 when site belongs to a different user", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(makeSite({ userId: "different-user" }));
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(404);
  });

  it("shows already-connected page when brokerSecretHash is already set", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(
      makeSite({ brokerSecretHash: "existing-hash" }),
    );
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Already connected");
    expect(prismaMock.site.update).not.toHaveBeenCalled();
  });

  it("400 when installation has zero repos", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    listReposMock.mockResolvedValue([]);
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("No repositories selected");
    expect(prismaMock.site.update).not.toHaveBeenCalled();
  });

  it("400 'Multiple repositories' only when site has no repo on file (fallback)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(makeSite()); // no githubRepoName set
    listReposMock.mockResolvedValue([
      { owner: "artist", name: "a" },
      { owner: "artist", name: "b" },
    ]);
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Multiple repositories selected");
    expect(prismaMock.site.update).not.toHaveBeenCalled();
  });

  it("happy path: multi-repo install with one repo matching the site's existing repo succeeds", async () => {
    // Real-world scenario: artist has multiple Stagecraft sites, so their
    // single GitHub App installation has access to many repos. The
    // install-callback should find the site's repo in the list rather
    // than rejecting on count.
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(
      makeSite({ githubRepoOwner: "artist", githubRepoName: "smoke-test-7" }),
    );
    listReposMock.mockResolvedValue([
      { owner: "artist", name: "smoke-test-1" },
      { owner: "artist", name: "smoke-test-2" },
      { owner: "artist", name: "smoke-test-7" },
      { owner: "artist", name: "smoke-test-9" },
    ]);
    prismaMock.site.update.mockResolvedValue({});

    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "98765", state }));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("GitHub App connected");
    expect(body).toContain("artist/smoke-test-7");
    expect(prismaMock.site.update).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        githubInstallationId: 98765,
        githubRepoOwner: "artist",
        githubRepoName: "smoke-test-7",
      }),
    });
  });

  it("400 'Repo not in install' when site has a repo on file but it's not in the installation list", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(
      makeSite({ githubRepoOwner: "artist", githubRepoName: "smoke-test-7" }),
    );
    listReposMock.mockResolvedValue([
      { owner: "artist", name: "smoke-test-1" },
      { owner: "artist", name: "smoke-test-2" },
    ]);
    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Repo not in install");
    expect(body).toContain("artist/smoke-test-7");
    expect(prismaMock.site.update).not.toHaveBeenCalled();
  });

  it("happy path: persists installation, generates secret, renders reveal page", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    listReposMock.mockResolvedValue([{ owner: "artist", name: "site" }]);
    prismaMock.site.update.mockResolvedValue({});

    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "98765", state }));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("GitHub App connected");
    expect(body).toContain("artist/site");
    expect(body).toContain("Your broker secret");
    expect(body).toContain("STAGECRAFT_BROKER_SECRET");

    expect(prismaMock.site.update).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        githubInstallationId: 98765,
        githubRepoOwner: "artist",
        githubRepoName: "site",
        brokerSecretHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        githubAppSuspended: false,
      }),
    });
  });

  it("plaintext secret in the response matches the hash that was persisted", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    listReposMock.mockResolvedValue([{ owner: "artist", name: "site" }]);

    const state = await signInstallState({ siteId: "site-1", userId: "user-1" });
    const res = await GET(buildRequest({ installation_id: "1", state }));
    const body = await res.text();

    const match = body.match(/<pre>(scbs_[0-9a-f]{64})<\/pre>/);
    expect(match).not.toBeNull();
    const plaintext = match![1];

    const { hashBrokerSecret } = await import("@/lib/broker-secret");
    const persistedHash = prismaMock.site.update.mock.calls[0][0].data.brokerSecretHash as string;
    expect(persistedHash).toBe(hashBrokerSecret(plaintext));
  });
});
