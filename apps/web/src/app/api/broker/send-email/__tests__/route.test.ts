import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, sendMock } = vi.hoisted(() => ({
  prismaMock: { site: { findUnique: vi.fn() } },
  sendMock: vi.fn(),
}));

vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email-broker", () => ({ sendBrokeredEmail: sendMock }));

import { POST } from "../route";
import { generateBrokerSecret, hashBrokerSecret } from "@/lib/broker-secret";

beforeEach(() => {
  prismaMock.site.findUnique.mockReset();
  sendMock.mockReset();
});

afterEach(() => {
  // no-op
});

function buildRequest(opts: { bearer?: string; body?: unknown; rawBody?: string } = {}) {
  return new Request("http://platform.test/api/broker/send-email", {
    method: "POST",
    headers: {
      ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
      "content-type": "application/json",
    },
    body: opts.rawBody ?? JSON.stringify(opts.body ?? {}),
  });
}

function makeSite(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-1",
    brokerSecretHash: hashBrokerSecret("scbs_known"),
    user: { email: "artist@example.com" },
    ...overrides,
  };
}

describe("POST /api/broker/send-email", () => {
  it("401 when Authorization Bearer is missing", async () => {
    const res = await POST(buildRequest({ body: { siteId: "s1", to: "a@b.c", subject: "x", text: "y" } }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("missing-bearer");
  });

  it("400 on body that fails schema validation", async () => {
    const res = await POST(buildRequest({ bearer: "scbs_x", body: { to: "not-email" } }));
    expect(res.status).toBe(400);
  });

  it("404 when siteId doesn't exist", async () => {
    prismaMock.site.findUnique.mockResolvedValue(null);
    const res = await POST(
      buildRequest({ bearer: "scbs_x", body: { siteId: "missing", to: "a@example.com", subject: "x", text: "y" } }),
    );
    expect(res.status).toBe(404);
  });

  it("401 on broker secret mismatch", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    const res = await POST(
      buildRequest({ bearer: "scbs_wrong", body: { siteId: "site-1", to: "artist@example.com", subject: "x", text: "y" } }),
    );
    expect(res.status).toBe(401);
  });

  it("403 when `to` is not the site owner's email (anti-relay)", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    const res = await POST(
      buildRequest({
        bearer: "scbs_known",
        body: { siteId: "site-1", to: "attacker@example.com", subject: "x", text: "y" },
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("to-not-allowed");
  });

  it("matches `to` against owner email case/whitespace-insensitively", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite({ user: { email: "Artist@Example.com" } }));
    sendMock.mockResolvedValue({ ok: true, messageId: "msg_1" });
    const res = await POST(
      buildRequest({
        bearer: "scbs_known",
        body: { siteId: "site-1", to: "  artist@example.com  ", subject: "x", text: "y" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("200 + delegates to sendBrokeredEmail when secret + recipient check pass", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    sendMock.mockResolvedValue({ ok: true, messageId: "msg_42" });

    const res = await POST(
      buildRequest({
        bearer: "scbs_known",
        body: {
          siteId: "site-1",
          to: "artist@example.com",
          subject: "Sign in",
          text: "click https://x.test/auth/verify?t=...",
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; messageId: string };
    expect(body).toEqual({ ok: true, messageId: "msg_42" });
    expect(sendMock).toHaveBeenCalledWith({
      to: "artist@example.com",
      subject: "Sign in",
      text: "click https://x.test/auth/verify?t=...",
    });
  });

  it("503 when platform Resend env vars are not configured", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    sendMock.mockResolvedValue({ ok: false, code: "not-configured", message: "no key" });
    const res = await POST(
      buildRequest({
        bearer: "scbs_known",
        body: { siteId: "site-1", to: "artist@example.com", subject: "x", text: "y" },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("502 when Resend send call fails", async () => {
    prismaMock.site.findUnique.mockResolvedValue(makeSite());
    sendMock.mockResolvedValue({ ok: false, code: "send-failed", message: "rate limit" });
    const res = await POST(
      buildRequest({
        bearer: "scbs_known",
        body: { siteId: "site-1", to: "artist@example.com", subject: "x", text: "y" },
      }),
    );
    expect(res.status).toBe(502);
  });
});

describe("hash compare uses brokerSecretMatches end-to-end", () => {
  it("a freshly-generated secret hashes consistently for the route", async () => {
    const { plaintext, hash } = generateBrokerSecret();
    prismaMock.site.findUnique.mockResolvedValue({
      id: "s",
      brokerSecretHash: hash,
      user: { email: "artist@example.com" },
    });
    sendMock.mockResolvedValue({ ok: true, messageId: "msg" });

    const res = await POST(
      buildRequest({
        bearer: plaintext,
        body: { siteId: "s", to: "artist@example.com", subject: "x", text: "y" },
      }),
    );
    expect(res.status).toBe(200);
  });
});
