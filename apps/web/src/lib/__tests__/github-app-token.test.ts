import { generateKeyPairSync } from "node:crypto";
import { describe, it, expect } from "vitest";

import { normalizePrivateKey } from "../github-app-token";

function generateRsaKey() {
  return generateKeyPairSync("rsa", { modulusLength: 2048 });
}

describe("normalizePrivateKey", () => {
  it("re-emits a PKCS#1 (`BEGIN RSA PRIVATE KEY`) input as PKCS#8", () => {
    const { privateKey } = generateRsaKey();
    const pkcs1 = privateKey.export({ type: "pkcs1", format: "pem" }) as string;
    expect(pkcs1).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);

    const out = normalizePrivateKey(pkcs1);
    expect(out).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(out).toMatch(/-----END PRIVATE KEY-----\n?$/);
  });

  it("re-emits a PKCS#8 (`BEGIN PRIVATE KEY`) input as PKCS#8 (idempotent)", () => {
    const { privateKey } = generateRsaKey();
    const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    expect(pkcs8).toMatch(/^-----BEGIN PRIVATE KEY-----/);

    const out = normalizePrivateKey(pkcs8);
    expect(out).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    // Round-trip preserves the key material
    expect(out.replace(/\s/g, "")).toBe(pkcs8.replace(/\s/g, ""));
  });

  it("handles env vars where newlines were escaped as literal \\n", () => {
    const { privateKey } = generateRsaKey();
    const pkcs1 = privateKey.export({ type: "pkcs1", format: "pem" }) as string;
    const escaped = pkcs1.replace(/\n/g, "\\n");
    expect(escaped).toContain("\\n");
    expect(escaped).not.toContain("\n");

    const out = normalizePrivateKey(escaped);
    expect(out).toMatch(/^-----BEGIN PRIVATE KEY-----/);
  });

  it("throws on garbage input", () => {
    expect(() => normalizePrivateKey("not a pem")).toThrow();
  });
});
