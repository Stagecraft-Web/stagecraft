import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, validateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  validateMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/integrations/resend", () => ({ validateResendToken: validateMock }));

import { POST } from "../route";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://platform.test/api/integrations/resend/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  validateMock.mockReset();
  authMock.mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/integrations/resend/preview", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(buildRequest({ token: "re_x" }));
    expect(res.status).toBe(401);
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("400 when token is missing", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("400 when Resend rejects the API key", async () => {
    validateMock.mockRejectedValue(new Error("Resend API error (401): unauthorized"));
    const res = await POST(buildRequest({ token: "re_bad" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Resend rejected the API key");
  });

  it("returns only `verified` domains (filters out pending/failed)", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [
        { id: "1", name: "ok.com", status: "verified" },
        { id: "2", name: "pending.com", status: "pending" },
        { id: "3", name: "failed.com", status: "failed" },
        { id: "4", name: "good.org", status: "verified" },
      ],
    });
    const res = await POST(buildRequest({ token: "re_good" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; verifiedDomains: string[]; restricted: boolean };
    expect(body).toEqual({ ok: true, verifiedDomains: ["ok.com", "good.org"], restricted: false });
  });

  it("returns empty list when no verified domains exist", async () => {
    validateMock.mockResolvedValue({
      restricted: false,
      domains: [{ id: "1", name: "p.com", status: "pending" }],
    });
    const res = await POST(buildRequest({ token: "re_x" }));
    const body = (await res.json()) as { verifiedDomains: string[]; restricted: boolean };
    expect(body.verifiedDomains).toEqual([]);
    expect(body.restricted).toBe(false);
  });

  it("surfaces restricted=true when Resend key is send-only", async () => {
    validateMock.mockResolvedValue({ restricted: true, domains: [] });
    const res = await POST(buildRequest({ token: "re_send_only" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { restricted: boolean; verifiedDomains: string[] };
    expect(body.restricted).toBe(true);
    expect(body.verifiedDomains).toEqual([]);
  });
});
