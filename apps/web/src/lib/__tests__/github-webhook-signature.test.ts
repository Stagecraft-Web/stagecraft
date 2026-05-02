import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyGitHubSignature } from "../github-webhook-signature";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.GITHUB_APP_WEBHOOK_SECRET = "test-webhook-secret";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function sign(body: string, secret = "test-webhook-secret"): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyGitHubSignature", () => {
  it("returns true for a valid signature", () => {
    const body = '{"action":"created"}';
    expect(verifyGitHubSignature(body, sign(body))).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const body = '{"action":"created"}';
    const sig = sign(body);
    expect(verifyGitHubSignature('{"action":"deleted"}', sig)).toBe(false);
  });

  it("returns false when the signature uses a different secret", () => {
    const body = '{"action":"created"}';
    expect(verifyGitHubSignature(body, sign(body, "wrong-secret"))).toBe(false);
  });

  it("returns false when the signature header is missing", () => {
    expect(verifyGitHubSignature("{}", null)).toBe(false);
  });

  it("returns false when the signature header has a malformed format", () => {
    expect(verifyGitHubSignature("{}", "sha1=abc")).toBe(false);
    expect(verifyGitHubSignature("{}", "abc")).toBe(false);
    expect(verifyGitHubSignature("{}", "sha256=ZZZZ")).toBe(false);
  });

  it("returns false when GITHUB_APP_WEBHOOK_SECRET is unset", () => {
    delete process.env.GITHUB_APP_WEBHOOK_SECRET;
    const body = "{}";
    expect(verifyGitHubSignature(body, sign(body, "any"))).toBe(false);
  });

  it("returns false for hex of the wrong length even with correct prefix", () => {
    expect(verifyGitHubSignature("{}", "sha256=abcd")).toBe(false);
  });
});
