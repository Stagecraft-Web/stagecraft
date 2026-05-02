import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { site: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/github", () => ({
  deleteRepo: vi.fn(),
  setRepoArchived: vi.fn(),
}));
vi.mock("@/lib/integrations/netlify", () => ({ deleteSite: vi.fn() }));

import { GET } from "../route";

beforeEach(() => {
  authMock.mockReset();
  prismaMock.site.findFirst.mockReset();
});

function fakeArgs(siteId: string) {
  return { params: Promise.resolve({ siteId }) };
}

describe("GET /api/sites/[siteId] response shape", () => {
  it("redacts brokerSecretHash from the response", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.site.findFirst.mockResolvedValue({
      id: "s1",
      userId: "u1",
      name: "Test",
      brokerSecretHash: "supersecrethash",
      githubInstallationId: 100,
      githubAppSuspended: false,
      jobs: [],
    });
    const res = await GET(new Request("http://t/x") as never, fakeArgs("s1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site: Record<string, unknown> };
    expect(body.site).not.toHaveProperty("brokerSecretHash");
    expect(body.site.id).toBe("s1");
    // Non-secret install state still flows through
    expect(body.site.githubInstallationId).toBe(100);
    expect(body.site.githubAppSuspended).toBe(false);
  });

  it("404 when no site matches the user", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.site.findFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://t/x") as never, fakeArgs("s1"));
    expect(res.status).toBe(404);
  });

  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://t/x") as never, fakeArgs("s1"));
    expect(res.status).toBe(401);
  });
});
