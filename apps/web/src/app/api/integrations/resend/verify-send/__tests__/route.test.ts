import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, validateMock, sendMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  validateMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/integrations/resend", () => ({
  validateResendToken: validateMock,
  sendResendEmail: sendMock,
}));

import { POST } from "../route";
import { verifyVerificationToken } from "@/lib/resend-verification";

const ORIGINAL_ENV = { ...process.env };

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://platform.test/api/integrations/resend/verify-send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  validateMock.mockReset();
  sendMock.mockReset();

  process.env = {
    ...ORIGINAL_ENV,
    STAGECRAFT_STATE_SIGNING_SECRET: "test-secret-please-do-not-use-in-prod",
  };
  authMock.mockResolvedValue({ user: { id: "user-1" } });
  validateMock.mockResolvedValue({ restricted: false, domains: [] });
  sendMock.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/integrations/resend/verify-send", () => {
  it("401 when not signed in", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(
      buildRequest({ token: "re_x", fromAddress: "noreply@x.com", adminEmail: "a@x.com" }),
    );
    expect(res.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("400 when adminEmail isn't a valid email", async () => {
    const res = await POST(
      buildRequest({ token: "re_x", fromAddress: "noreply@x.com", adminEmail: "not-email" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when Resend rejects the API key (validateResendToken throws)", async () => {
    validateMock.mockRejectedValue(new Error("Resend API error (401): unauthorized"));
    const res = await POST(
      buildRequest({ token: "re_bad", fromAddress: "onboarding@resend.dev", adminEmail: "a@x.com" }),
    );
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("502 when Resend send fails", async () => {
    sendMock.mockRejectedValue(new Error("Resend send failed (500): server error"));
    const res = await POST(
      buildRequest({ token: "re_good", fromAddress: "onboarding@resend.dev", adminEmail: "a@x.com" }),
    );
    expect(res.status).toBe(502);
  });

  it("200 + sends a 6-digit code via Resend + returns a verifiable token", async () => {
    let capturedText = "";
    sendMock.mockImplementation(async ({ text }: { text: string }) => {
      capturedText = text;
    });

    const res = await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "onboarding@resend.dev",
        adminEmail: "Artist@Example.COM",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; verificationToken: string; sentTo: string };
    expect(body.ok).toBe(true);
    expect(body.sentTo).toBe("artist@example.com"); // normalized

    // The text body should contain the same 6-digit code embedded in the token
    const codeMatch = capturedText.match(/(\d{6})/);
    expect(codeMatch).not.toBeNull();
    const codeInEmail = codeMatch![1];

    const decoded = await verifyVerificationToken(body.verificationToken);
    expect(decoded).not.toBeNull();
    expect(decoded!.adminEmail).toBe("artist@example.com");
    expect(decoded!.code).toBe(codeInEmail);
    expect(decoded!.userId).toBe("user-1");
  });

  it("calls Resend with the from + to we were given", async () => {
    let capturedArgs: { from?: string; to?: string; subject?: string } = {};
    sendMock.mockImplementation(async (args: { from: string; to: string; subject: string }) => {
      capturedArgs = args;
    });

    await POST(
      buildRequest({
        token: "re_good",
        fromAddress: "noreply@stagecraft.website",
        adminEmail: "owner@example.com",
      }),
    );

    expect(capturedArgs.from).toBe("noreply@stagecraft.website");
    expect(capturedArgs.to).toBe("owner@example.com");
    expect(capturedArgs.subject).toContain("Stagecraft");
  });
});
