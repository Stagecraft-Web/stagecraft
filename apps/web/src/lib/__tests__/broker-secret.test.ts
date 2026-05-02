import { describe, expect, it } from "vitest";

import {
  brokerSecretMatches,
  generateBrokerSecret,
  hashBrokerSecret,
} from "../broker-secret";

describe("generateBrokerSecret", () => {
  it("returns a plaintext with the scbs_ prefix and 64 hex chars after it", () => {
    const { plaintext } = generateBrokerSecret();
    expect(plaintext).toMatch(/^scbs_[0-9a-f]{64}$/);
  });

  it("returns a hash that matches hashBrokerSecret(plaintext)", () => {
    const { plaintext, hash } = generateBrokerSecret();
    expect(hash).toBe(hashBrokerSecret(plaintext));
  });

  it("produces a distinct secret on each call", () => {
    const a = generateBrokerSecret();
    const b = generateBrokerSecret();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("brokerSecretMatches", () => {
  it("returns true for a correct secret", () => {
    const { plaintext, hash } = generateBrokerSecret();
    expect(brokerSecretMatches(plaintext, hash)).toBe(true);
  });

  it("returns false for an incorrect secret", () => {
    const { hash } = generateBrokerSecret();
    expect(brokerSecretMatches("scbs_wrong", hash)).toBe(false);
  });

  it("returns false when the stored hash is the wrong length", () => {
    const { plaintext } = generateBrokerSecret();
    expect(brokerSecretMatches(plaintext, "short")).toBe(false);
  });
});
