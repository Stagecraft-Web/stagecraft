import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMagicLinkToken,
  createSessionToken,
  verifyMagicLinkToken,
  verifySessionToken,
} from "./auth";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MAGIC_LINK_SIGNING_SECRET;
  delete process.env.STAGECRAFT_BROKER_SECRET;
  process.env.MAGIC_LINK_SIGNING_SECRET = "test-secret-do-not-use-in-prod";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("auth tokens", () => {
  it("magic-link token round-trips", async () => {
    const token = await createMagicLinkToken("user@example.com");
    expect(await verifyMagicLinkToken(token)).toEqual({ email: "user@example.com" });
  });

  it("session token round-trips", async () => {
    const token = await createSessionToken("user@example.com");
    expect(await verifySessionToken(token)).toEqual({ email: "user@example.com" });
  });

  it("session tokens cannot pass as magic-link tokens", async () => {
    const token = await createSessionToken("user@example.com");
    expect(await verifyMagicLinkToken(token)).toBeNull();
  });

  it("magic-link tokens cannot pass as session tokens", async () => {
    const token = await createMagicLinkToken("user@example.com");
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("malformed tokens return null", async () => {
    expect(await verifyMagicLinkToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("tokens signed with a different secret are rejected", async () => {
    const token = await createSessionToken("user@example.com");
    process.env.MAGIC_LINK_SIGNING_SECRET = "different-secret";
    expect(await verifySessionToken(token)).toBeNull();
  });
});

describe("auth tokens: secret derived from STAGECRAFT_BROKER_SECRET", () => {
  it("derives a signing secret from STAGECRAFT_BROKER_SECRET when MAGIC_LINK_SIGNING_SECRET is unset", async () => {
    delete process.env.MAGIC_LINK_SIGNING_SECRET;
    process.env.STAGECRAFT_BROKER_SECRET = "scbs_test_broker_secret_12345";

    const token = await createSessionToken("user@example.com");
    expect(await verifySessionToken(token)).toEqual({ email: "user@example.com" });
  });

  it("explicit MAGIC_LINK_SIGNING_SECRET takes precedence over derived (back-compat)", async () => {
    // Two distinct sites with the same explicit signing secret but
    // different broker secrets should produce interchangeable tokens —
    // the broker secret is ignored when MAGIC_LINK_SIGNING_SECRET is
    // present.
    process.env.MAGIC_LINK_SIGNING_SECRET = "explicit-secret";
    process.env.STAGECRAFT_BROKER_SECRET = "broker-A";
    const token = await createSessionToken("user@example.com");

    process.env.STAGECRAFT_BROKER_SECRET = "broker-B";
    expect(await verifySessionToken(token)).toEqual({ email: "user@example.com" });
  });

  it("rotating STAGECRAFT_BROKER_SECRET invalidates derived-secret tokens (by design)", async () => {
    delete process.env.MAGIC_LINK_SIGNING_SECRET;
    process.env.STAGECRAFT_BROKER_SECRET = "broker-A";
    const token = await createSessionToken("user@example.com");

    process.env.STAGECRAFT_BROKER_SECRET = "broker-B";
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("throws when neither secret is set", async () => {
    delete process.env.MAGIC_LINK_SIGNING_SECRET;
    delete process.env.STAGECRAFT_BROKER_SECRET;
    await expect(createSessionToken("user@example.com")).rejects.toThrow(
      /Neither MAGIC_LINK_SIGNING_SECRET nor STAGECRAFT_BROKER_SECRET/,
    );
  });
});
