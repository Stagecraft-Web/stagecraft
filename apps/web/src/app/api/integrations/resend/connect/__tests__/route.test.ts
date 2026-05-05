import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, validateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    integrationAccount: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  validateMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/resend", () => ({ validateResendToken: validateMock }));

import { POST, DELETE } from "../route";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://platform.test/api/integrations/resend/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  prismaMock.integrationAccount.upsert.mockReset();
  prismaMock.integrationAccount.deleteMany.mockReset();
  validateMock.mockReset();

  authMock.mockResolvedValue({ user: { id: "user-1" } });
  prismaMock.integrationAccount.upsert.mockResolvedValue({});
  prismaMock.integrationAccount.deleteMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/integrations/resend/connect", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(buildRequest({ token: "x", fromAddress: "a@example.com" }));
    expect(res.status).toBe(401);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("400 when token is missing", async () => {
    const res = await POST(buildRequest({ fromAddress: "a@example.com" }));
    expect(res.status).toBe(400);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("400 when fromAddress isn't a valid email", async () => {
    const res = await POST(buildRequest({ token: "re_x", fromAddress: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("400 when Resend rejects the API key", async () => {
    validateMock.mockRejectedValue(new Error("Resend API error (401): unauthorized"));
    const res = await POST(buildRequest({ token: "re_bad", fromAddress: "a@example.com" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Resend rejected the API key");
  });

  it("400 when fromAddress's domain isn't on a verified Resend domain", async () => {
    validateMock.mockResolvedValue({
      domains: [
        { id: "1", name: "verified.com", status: "verified" },
        { id: "2", name: "pending.com", status: "pending" },
      ],
    });
    const res = await POST(
      buildRequest({ token: "re_x", fromAddress: "noreply@somewhere-else.com" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("isn't on a verified Resend domain");
    expect(body.error).toContain("verified.com");
  });

  it("400 with helpful hint when artist has no verified domains at all", async () => {
    validateMock.mockResolvedValue({ domains: [{ id: "p", name: "pending.com", status: "pending" }] });
    const res = await POST(
      buildRequest({ token: "re_x", fromAddress: "noreply@anything.com" }),
    );
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("No verified domains");
  });

  it("200 + upserts IntegrationAccount when token + fromAddress are valid", async () => {
    validateMock.mockResolvedValue({
      domains: [{ id: "1", name: "stagecraft.website", status: "verified" }],
    });
    const res = await POST(
      buildRequest({ token: "re_good", fromAddress: "noreply@stagecraft.website" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; fromAddress: string };
    expect(body).toEqual({ ok: true, fromAddress: "noreply@stagecraft.website" });
    expect(prismaMock.integrationAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_provider: { userId: "user-1", provider: "resend" } },
        create: expect.objectContaining({
          userId: "user-1",
          provider: "resend",
          accessToken: "re_good",
          metadata: { fromAddress: "noreply@stagecraft.website" },
        }),
      }),
    );
  });

  it("accepts onboarding@resend.dev as a fallback sender (Resend's sandbox; no verified domain required)", async () => {
    validateMock.mockResolvedValue({ domains: [] });
    const res = await POST(
      buildRequest({ token: "re_good", fromAddress: "onboarding@resend.dev" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; fromAddress: string };
    expect(body.fromAddress).toBe("onboarding@resend.dev");
  });

  it("matches verified-domain check case-insensitively", async () => {
    validateMock.mockResolvedValue({
      domains: [{ id: "1", name: "STAGECRAFT.website", status: "verified" }],
    });
    const res = await POST(
      buildRequest({ token: "re_good", fromAddress: "Noreply@Stagecraft.Website" }),
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/integrations/resend/connect", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("200 + deletes the resend integration row", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(prismaMock.integrationAccount.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", provider: "resend" },
    });
  });
});
