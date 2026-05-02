import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, handleInstallMock, handleReposMock } = vi.hoisted(() => ({
  prismaMock: {
    webhookDelivery: { create: vi.fn() },
    site: { findFirst: vi.fn(), update: vi.fn() },
  },
  handleInstallMock: vi.fn(),
  handleReposMock: vi.fn(),
}));

vi.mock("@stagecraft/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/github-webhook-handlers", () => ({
  handleInstallationEvent: handleInstallMock,
  handleRepositoriesEvent: handleReposMock,
}));

import { POST } from "../route";

const SECRET = "test-webhook-secret";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.GITHUB_APP_WEBHOOK_SECRET = SECRET;
  prismaMock.webhookDelivery.create.mockReset();
  prismaMock.webhookDelivery.create.mockResolvedValue({ id: "wd-1" });
  handleInstallMock.mockReset();
  handleInstallMock.mockResolvedValue({ applied: true, note: "ok" });
  handleReposMock.mockReset();
  handleReposMock.mockResolvedValue({ applied: true, note: "ok" });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

function buildRequest(opts: {
  body: unknown;
  rawBody?: string;
  event?: string;
  delivery?: string;
  signature?: string;
}) {
  const rawBody = opts.rawBody ?? JSON.stringify(opts.body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.event) headers["x-github-event"] = opts.event;
  if (opts.delivery) headers["x-github-delivery"] = opts.delivery;
  headers["x-hub-signature-256"] = opts.signature ?? sign(rawBody);
  return new Request("http://platform.test/api/github/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/github/webhook", () => {
  it("401 when signature is invalid", async () => {
    const res = await POST(
      buildRequest({
        body: { action: "created", installation: { id: 1 } },
        event: "installation",
        delivery: "d1",
        signature: "sha256=" + "0".repeat(64),
      }),
    );
    expect(res.status).toBe(401);
    expect(prismaMock.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it("400 when X-GitHub-Event header is missing", async () => {
    const res = await POST(
      buildRequest({ body: { action: "created", installation: { id: 1 } }, delivery: "d1" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 when X-GitHub-Delivery header is missing", async () => {
    const res = await POST(
      buildRequest({ body: { action: "created", installation: { id: 1 } }, event: "installation" }),
    );
    expect(res.status).toBe(400);
  });

  it("treats P2002 unique-constraint as a duplicate redelivery (200, applied=false)", async () => {
    prismaMock.webhookDelivery.create.mockRejectedValueOnce({ code: "P2002" });
    const res = await POST(
      buildRequest({
        body: { action: "created", installation: { id: 1 } },
        event: "installation",
        delivery: "d-dup",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: true });
    expect(handleInstallMock).not.toHaveBeenCalled();
  });

  it("dispatches installation events to handleInstallationEvent", async () => {
    handleInstallMock.mockResolvedValue({ applied: true, note: "suspended site x" });
    const res = await POST(
      buildRequest({
        body: { action: "suspend", installation: { id: 42 } },
        event: "installation",
        delivery: "d-install",
      }),
    );
    expect(res.status).toBe(200);
    expect(handleInstallMock).toHaveBeenCalledWith("suspend", 42);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, applied: true });
  });

  it("400 on installation payload that fails schema (action enum)", async () => {
    const res = await POST(
      buildRequest({
        body: { action: "exploded", installation: { id: 1 } },
        event: "installation",
        delivery: "d-bad",
      }),
    );
    expect(res.status).toBe(400);
    expect(handleInstallMock).not.toHaveBeenCalled();
  });

  it("dispatches installation_repositories.removed with the right repo list", async () => {
    handleReposMock.mockResolvedValue({ applied: true, note: "cleared" });
    const res = await POST(
      buildRequest({
        body: {
          action: "removed",
          installation: { id: 99 },
          repositories_removed: [{ name: "site" }],
        },
        event: "installation_repositories",
        delivery: "d-repos-removed",
      }),
    );
    expect(res.status).toBe(200);
    expect(handleReposMock).toHaveBeenCalledWith("removed", 99, [{ name: "site" }]);
  });

  it("dispatches installation_repositories.added with repositories_added", async () => {
    handleReposMock.mockResolvedValue({ applied: false, note: "noop" });
    await POST(
      buildRequest({
        body: {
          action: "added",
          installation: { id: 99 },
          repositories_added: [{ name: "blog" }],
        },
        event: "installation_repositories",
        delivery: "d-repos-added",
      }),
    );
    expect(handleReposMock).toHaveBeenCalledWith("added", 99, [{ name: "blog" }]);
  });

  it("ignores unsubscribed events with 200 + ignored note", async () => {
    const res = await POST(
      buildRequest({
        body: {},
        event: "push",
        delivery: "d-push",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ignored: "push" });
  });

  it("uses the raw body for signature verification (not re-serialized JSON)", async () => {
    // A body with significant whitespace would re-serialize to a different
    // string. The signature must be validated against the raw bytes.
    const rawBody = '{\n  "action": "created",\n  "installation": { "id": 1 }\n}';
    const res = await POST(
      buildRequest({
        body: undefined,
        rawBody,
        event: "installation",
        delivery: "d-raw",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("500 when delivery record insert fails for a non-unique reason", async () => {
    prismaMock.webhookDelivery.create.mockRejectedValueOnce(new Error("connection lost"));
    const res = await POST(
      buildRequest({
        body: { action: "created", installation: { id: 1 } },
        event: "installation",
        delivery: "d-fail",
      }),
    );
    expect(res.status).toBe(500);
  });
});
