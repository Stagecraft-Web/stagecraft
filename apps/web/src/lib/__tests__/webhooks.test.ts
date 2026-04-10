import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyGitHubSignature, verifyNetlifyToken } from "../webhooks";

const SECRET = "test-webhook-secret";

describe("verifyGitHubSignature", () => {
  function sign(body: string) {
    return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
  }

  it("accepts a valid signature", () => {
    const body = '{"action":"opened"}';
    expect(verifyGitHubSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = '{"action":"opened"}';
    expect(verifyGitHubSignature('{"action":"closed"}', sign(body), SECRET)).toBe(false);
  });

  it("rejects an incorrect signature", () => {
    expect(verifyGitHubSignature("{}", "sha256=deadbeef", SECRET)).toBe(false);
  });

  it("rejects a null signature", () => {
    expect(verifyGitHubSignature("{}", null, SECRET)).toBe(false);
  });

  it("rejects a signature without the sha256= prefix", () => {
    const body = "{}";
    const bare = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyGitHubSignature(body, bare, SECRET)).toBe(false);
  });
});

describe("verifyNetlifyToken", () => {
  it("accepts a valid Bearer token in Authorization header", () => {
    expect(verifyNetlifyToken(null, `Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("accepts a valid token in the query parameter", () => {
    expect(verifyNetlifyToken(SECRET, null, SECRET)).toBe(true);
  });

  it("prefers the Authorization header over the query parameter", () => {
    expect(verifyNetlifyToken("wrong", `Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects an invalid token", () => {
    expect(verifyNetlifyToken("wrong-token-value", null, SECRET)).toBe(false);
  });

  it("rejects when neither token nor header is provided", () => {
    expect(verifyNetlifyToken(null, null, SECRET)).toBe(false);
  });

  it("rejects a token with a different length", () => {
    expect(verifyNetlifyToken("short", null, SECRET)).toBe(false);
  });
});
