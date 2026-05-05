import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, validateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    integrationAccount: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    // The route uses prisma.$transaction([upsert, user.update]); we
    // mock it to just resolve all the queries, and assert the
    // individual mocks were called with the right args.
    $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
  },
  validateMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/resend", () => ({ validateResendToken: validateMock }));

import { POST, DELETE } from "../route";
import { signVerificationToken } from "@/lib/resend-verification";

const ORIGINAL_ENV = { ...process.env };

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
  prismaMock.user.update.mockReset();
  validateMock.mockReset();

  process.env = {
    ...ORIGINAL_ENV,
    STAGECRAFT_STATE_SIGNING_SECRET: "test-secret-please-do-not-use-in-prod",
  };
  authMock.mockResolvedValue({ user: { id: "user-1" } });
  prismaMock.integrationAccount.upsert.mockResolvedValue({});
  prismaMock.integrationAccount.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.user.update.mockResolvedValue({ id: "user-1", email: "x@x.com" });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

async function makeVerificationToken(overrides: { adminEmail?: string; code?: string; userId?: string } = {}) {
  return signVerificationToken({
    adminEmail: overrides.adminEmail ?? "artist@example.com",
    code: overrides.code ?? "123456",
    userId: overrides.userId ?? "user-1",
  });
}

describe("POST /api/integrations/resend/connect", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const verificationToken = await makeVerificationToken();
    const res = await POST(
      buildRequest({
        token: "re_x",
        fromAddress: "noreply@stagecraft.website",
        verificationToken,
        code: "123456",
      }),
    );
    expect(res.status).toBe(401);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("400 when verificationToken is missing", async () => {
    const res = await POST(
      buildRequest({ token: "re_x", fromAddress: "noreply@x.com", code: "123456" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when code isn't 6 digits", async () => {
    const verificationToken = await makeVerificationToken();
    const res = await POST(
      buildRequest({
        token: "re_x",
        fromAddress: "noreply@x.com",
        verificationToken,
        code: "12abc",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when Resend rejects the API key", async () => {
    validateMock.mockRejectedValue(new Error("Resend API error (401): unauthorized"));
    const verificationToken = await makeVerificationToken();
    const res = await POST(
      buildRequest({
        token: "re_bad",
        fromAddress: "noreply@stagecraft.website",
        verificationToken,
        code: "123456",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("Resend rejected the API key"),
    });
  });

  it("400 when verificationToken is invalid / expired", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "stagecraft.website", status: "verified" }],
    });
    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@stagecraft.website",
        verificationToken: "obvious-garbage",
        code: "123456",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("expired or invalid"),
    });
  });

  it("403 when verification token belongs to a different user", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "stagecraft.website", status: "verified" }],
    });
    const verificationToken = await makeVerificationToken({ userId: "other-user" });
    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@stagecraft.website",
        verificationToken,
        code: "123456",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("400 when user-entered code doesn't match the one we sent", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "stagecraft.website", status: "verified" }],
    });
    const verificationToken = await makeVerificationToken({ code: "123456" });
    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@stagecraft.website",
        verificationToken,
        code: "999999",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("Code didn't match"),
    });
  });

  it("400 when sender domain isn't on a verified Resend domain (and isn't sandbox)", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "different.com", status: "verified" }],
    });
    const verificationToken = await makeVerificationToken();
    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@notmine.com",
        verificationToken,
        code: "123456",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when key is restricted but sender isn't sandbox", async () => {
    validateMock.mockResolvedValue({ restricted: true, domains: [] });
    const verificationToken = await makeVerificationToken();
    const res = await POST(
      buildRequest({
        token: "re_send_only",
        fromAddress: "noreply@artist.com",
        verificationToken,
        code: "123456",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("restricted to sending only"),
    });
  });

  it("200 + persists IntegrationAccount AND writes verified email to User.email when everything checks out", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "stagecraft.website", status: "verified" }],
    });
    const verificationToken = await makeVerificationToken({
      adminEmail: "artist@example.com",
      code: "424242",
    });
    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@stagecraft.website",
        verificationToken,
        code: "424242",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; fromAddress: string; adminEmail: string };
    expect(body).toEqual({
      ok: true,
      fromAddress: "noreply@stagecraft.website",
      adminEmail: "artist@example.com",
    });
    expect(prismaMock.integrationAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accessToken: "re_good",
          providerAccountId: "artist@example.com",
          metadata: { fromAddress: "noreply@stagecraft.website" },
        }),
      }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "artist@example.com" },
    });
  });

  it("200 + persists when sandbox sender + restricted key + valid code", async () => {
    validateMock.mockResolvedValue({ restricted: true, domains: [] });
    const verificationToken = await makeVerificationToken({
      adminEmail: "owner@example.com",
      code: "111222",
    });
    const res = await POST(
      buildRequest({
        token: "re_send_only",
        fromAddress: "onboarding@resend.dev",
        verificationToken,
        code: "111222",
      }),
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
